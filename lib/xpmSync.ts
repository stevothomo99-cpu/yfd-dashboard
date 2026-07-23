import { getSupabaseAdmin } from "./supabase";
import { getSettings } from "./settings";
import {
  fetchXpmJobsForPartner,
  fetchAllXpmStaffRecords,
  uniqueClientsFromJobs,
  isXpmConfigured,
  XpmNotConfiguredError,
} from "./xpm";

// Full-replace sync of the XPM-native work-item system's reference data
// (staff/customers/jobs) from a live XPM tenant -- the "wire in real data"
// step that replaces the trial dummy rows. Tasks are dashboard-native and
// are never touched here, except that a job dropping out of the partner's
// InProgress list (completed, reassigned to a different partner, etc.)
// takes its tasks with it -- consistent with lib/workflow.ts's existing
// assumption that the jobs table only ever holds current InProgress jobs.
//
// Mapping confirmed directly against the live tenant: a job's `partner`
// field is the Partner filter itself (scopes which jobs are "ours"), and a
// job's `manager` field is our internal "Staff" role. The Partner named in
// Settings becomes the sole "Partner" role row; everyone who manages one of
// their jobs becomes a "Staff" role row.

export interface WorkflowSyncResult {
  partnerName: string;
  staffUpserted: number;
  staffRemoved: number;
  customersUpserted: number;
  customersRemoved: number;
  jobsUpserted: number;
  jobsRemoved: number;
}

interface IdXpmIdRow {
  id: string;
  xpm_staff_id?: string | null;
  xpm_client_id?: string | null;
  xpm_job_id?: string | null;
}

export async function syncWorkflowFromXpm(): Promise<WorkflowSyncResult> {
  if (!isXpmConfigured()) throw new XpmNotConfiguredError();

  const settings = await getSettings();
  const partnerName = settings.partnerName.trim();
  if (!partnerName) {
    throw new Error("Set a Partner name in Settings before syncing.");
  }

  const [jobs, allStaff] = await Promise.all([
    fetchXpmJobsForPartner(partnerName),
    fetchAllXpmStaffRecords(),
  ]);

  const partnerRecord = allStaff.find((s) => s.name === partnerName);
  if (!partnerRecord) {
    throw new Error(
      `No XPM staff member named "${partnerName}" -- check the Partner filter spelling in Settings.`,
    );
  }

  const managerIds = new Set<string>();
  for (const job of jobs) {
    if (job.manager?.uuid) managerIds.add(job.manager.uuid);
  }
  // The Partner is sometimes also their own job's manager (e.g. an internal
  // job) -- exclude their uuid here so they don't appear twice in the same
  // upsert batch (once as Partner, once as Staff), which Postgres rejects.
  managerIds.delete(partnerRecord.uuid);
  const managerRecords = allStaff.filter((s) => managerIds.has(s.uuid));
  const clients = uniqueClientsFromJobs(jobs);

  const admin = getSupabaseAdmin();

  // -- Staff: Partner + everyone who manages one of their jobs. Deduped by
  // xpm_staff_id (Map, so a later entry for the same id just overwrites the
  // earlier one) -- Postgres rejects an upsert whose VALUES list touches
  // the same ON CONFLICT key twice, and XPM's own data has repeatedly shown
  // up with unexpected self-references (e.g. the Partner also managing one
  // of their own jobs), so dedup defensively rather than chasing each case
  // individually. --
  const staffById = new Map<
    string,
    { xpm_staff_id: string; name: string; email: string; role: "Partner" | "Staff"; included: true }
  >();
  staffById.set(partnerRecord.uuid, {
    xpm_staff_id: partnerRecord.uuid,
    name: partnerRecord.name,
    email: partnerRecord.email,
    role: "Partner",
    included: true,
  });
  for (const s of managerRecords) {
    if (staffById.has(s.uuid)) continue;
    staffById.set(s.uuid, { xpm_staff_id: s.uuid, name: s.name, email: s.email, role: "Staff", included: true });
  }
  const staffUpserts = Array.from(staffById.values());

  const { data: upsertedStaff, error: staffUpsertError } = await admin
    .from("staff")
    .upsert(staffUpserts, { onConflict: "xpm_staff_id" })
    .select("id, xpm_staff_id");
  if (staffUpsertError) throw new Error(`Staff upsert failed: ${staffUpsertError.message}`);

  const staffIdByXpmId = new Map(
    (upsertedStaff ?? []).map((s) => [s.xpm_staff_id as string, s.id as string]),
  );
  const partnerLocalId = staffIdByXpmId.get(partnerRecord.uuid);
  if (!partnerLocalId) throw new Error("Partner staff upsert did not return an id.");

  // -- Customers: every client attached to one of the Partner's jobs
  // (deduped by xpm_client_id, same reasoning as staff above) --
  const customerById = new Map<string, { xpm_client_id: string; name: string; partner_id: string }>();
  for (const c of clients) {
    if (customerById.has(c.id)) continue;
    customerById.set(c.id, { xpm_client_id: c.id, name: c.name, partner_id: partnerLocalId });
  }
  const customerUpserts = Array.from(customerById.values());

  const { data: upsertedCustomers, error: customerUpsertError } = await admin
    .from("customers")
    .upsert(customerUpserts, { onConflict: "xpm_client_id" })
    .select("id, xpm_client_id");
  if (customerUpsertError) throw new Error(`Customer upsert failed: ${customerUpsertError.message}`);

  const customerIdByXpmId = new Map(
    (upsertedCustomers ?? []).map((c) => [c.xpm_client_id as string, c.id as string]),
  );

  // -- Jobs (deduped by xpm_job_id, same reasoning as staff above) --
  const jobById = new Map<
    string,
    { xpm_job_id: string; customer_id: string; name: string; partner_id: string; manager_id: string | null }
  >();
  for (const job of jobs) {
    if (!job.client?.uuid || !customerIdByXpmId.has(job.client.uuid)) continue;
    if (jobById.has(job.uuid)) continue;
    jobById.set(job.uuid, {
      xpm_job_id: job.uuid,
      customer_id: customerIdByXpmId.get(job.client.uuid)!,
      name: job.name,
      partner_id: partnerLocalId,
      manager_id: job.manager?.uuid ? staffIdByXpmId.get(job.manager.uuid) ?? null : null,
    });
  }
  const jobUpserts = Array.from(jobById.values());

  const { error: jobUpsertError } =
    jobUpserts.length > 0
      ? await admin.from("jobs").upsert(jobUpserts, { onConflict: "xpm_job_id" })
      : { error: null };
  if (jobUpsertError) throw new Error(`Job upsert failed: ${jobUpsertError.message}`);

  // -- Prune stale rows: anything left over from the dummy trial data (no
  // xpm_*_id) or previously synced but no longer in the Partner's current
  // InProgress book of business. Children before parents to respect FKs. --
  const keepJobXpmIds = new Set(jobUpserts.map((j) => j.xpm_job_id));
  const { data: existingJobs, error: existingJobsError } = await admin
    .from("jobs")
    .select("id, xpm_job_id")
    .returns<IdXpmIdRow[]>();
  if (existingJobsError) throw new Error(`Job lookup failed: ${existingJobsError.message}`);

  const staleJobIds = (existingJobs ?? [])
    .filter((j) => !j.xpm_job_id || !keepJobXpmIds.has(j.xpm_job_id))
    .map((j) => j.id);

  if (staleJobIds.length > 0) {
    const { error: taskDeleteError } = await admin.from("tasks").delete().in("job_id", staleJobIds);
    if (taskDeleteError) throw new Error(`Stale task cleanup failed: ${taskDeleteError.message}`);

    const { error: jobDeleteError } = await admin.from("jobs").delete().in("id", staleJobIds);
    if (jobDeleteError) throw new Error(`Stale job cleanup failed: ${jobDeleteError.message}`);
  }

  const keepCustomerXpmIds = new Set(customerUpserts.map((c) => c.xpm_client_id));
  const { data: existingCustomers, error: existingCustomersError } = await admin
    .from("customers")
    .select("id, xpm_client_id")
    .returns<IdXpmIdRow[]>();
  if (existingCustomersError) throw new Error(`Customer lookup failed: ${existingCustomersError.message}`);

  const staleCustomerIds = (existingCustomers ?? [])
    .filter((c) => !c.xpm_client_id || !keepCustomerXpmIds.has(c.xpm_client_id))
    .map((c) => c.id);

  if (staleCustomerIds.length > 0) {
    const { error: customerDeleteError } = await admin
      .from("customers")
      .delete()
      .in("id", staleCustomerIds);
    if (customerDeleteError) throw new Error(`Stale customer cleanup failed: ${customerDeleteError.message}`);
  }

  const keepStaffXpmIds = new Set(staffUpserts.map((s) => s.xpm_staff_id));
  const { data: existingStaff, error: existingStaffError } = await admin
    .from("staff")
    .select("id, xpm_staff_id")
    .returns<IdXpmIdRow[]>();
  if (existingStaffError) throw new Error(`Staff lookup failed: ${existingStaffError.message}`);

  const staleStaffIds = (existingStaff ?? [])
    .filter((s) => !s.xpm_staff_id || !keepStaffXpmIds.has(s.xpm_staff_id))
    .map((s) => s.id);

  if (staleStaffIds.length > 0) {
    // Defensive: clear any remaining task assignments to a staff row that's
    // about to be removed before deleting it (should only ever be dummy
    // trial tasks left dangling by the job/customer cleanup above).
    await admin.from("tasks").update({ assignee_id: null }).in("assignee_id", staleStaffIds);
    await admin.from("tasks").update({ temp_assignee_id: null }).in("temp_assignee_id", staleStaffIds);

    const { error: staffDeleteError } = await admin.from("staff").delete().in("id", staleStaffIds);
    if (staffDeleteError) throw new Error(`Stale staff cleanup failed: ${staffDeleteError.message}`);
  }

  return {
    partnerName,
    staffUpserted: staffUpserts.length,
    staffRemoved: staleStaffIds.length,
    customersUpserted: customerUpserts.length,
    customersRemoved: staleCustomerIds.length,
    jobsUpserted: jobUpserts.length,
    jobsRemoved: staleJobIds.length,
  };
}
