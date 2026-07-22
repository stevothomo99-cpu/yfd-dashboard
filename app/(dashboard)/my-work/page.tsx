import { auth } from "@/auth";
import MyWorkPageClient from "./MyWorkPageClient";
import {
  getInProgressJobsForPartner,
  getPartners,
  getStaffByEmail,
  getWorkBoardForStaff,
  listStaff,
  listStatuses,
  listTaskTypes,
} from "@/lib/workflow";
import type { JobWithCustomer } from "@/types/workflow";

// Server entry point for the per-user Work Item board. Identity is resolved
// strictly from the logged-in session's email, matched (case-insensitively)
// against staff.email -- the same email a person's XPM user record uses, so
// the two are expected to already line up (see lib/staffLink.ts for the
// same convention applied to Karbon<->XPM). The board itself is scoped by
// that staff member's place in the Partner > Manager > Staff hierarchy (see
// lib/workflow.ts's getWorkBoardForStaff): a Partner sees a practice-wide
// roll-up, a Manager sees their team's work, plain Staff see just their own.
//
// Admins get an override dropdown (for QA / helping a colleague), since
// dashboard_users isn't fully linked to every staff row yet -- everyone else
// only ever sees their own resolved board.
export default async function MyWorkPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const sessionStaff = session?.user?.email ? await getStaffByEmail(session.user.email) : null;
  const allStaff = isAdmin ? await listStaff() : [];

  const activeStaff = sessionStaff ?? (isAdmin ? allStaff[0] ?? null : null);
  const tasks = activeStaff ? await getWorkBoardForStaff(activeStaff) : [];

  // Reference data for the "+ New Task" modal -- small datasets (single-digit
  // partners/managers/jobs today), fetched up front server-side same as
  // /jobs, so the modal never has to refetch on open.
  const [partners, staffForForm, statuses, taskTypes] = await Promise.all([
    getPartners(),
    isAdmin ? Promise.resolve(allStaff) : listStaff(),
    listStatuses(),
    listTaskTypes(),
  ]);
  const jobsByPartner = await Promise.all(partners.map((p) => getInProgressJobsForPartner(p.id)));
  const jobsById = new Map<string, JobWithCustomer>();
  for (const jobs of jobsByPartner) for (const job of jobs) jobsById.set(job.id, job);
  const allJobs = Array.from(jobsById.values());

  return (
    <MyWorkPageClient
      allStaff={allStaff}
      isAdmin={isAdmin}
      hasSessionMatch={Boolean(sessionStaff)}
      defaultStaffId={activeStaff?.id ?? null}
      defaultStaffName={activeStaff?.name ?? null}
      initialTasks={tasks}
      jobs={allJobs}
      staffOptions={staffForForm}
      statuses={statuses}
      taskTypes={taskTypes}
    />
  );
}
