import { auth } from "@/auth";
import MyWorkPageClient from "./MyWorkPageClient";
import {
  getClientsInScopeForStaff,
  getPartners,
  getStaffByEmail,
  getWorkBoardForStaff,
  listStaff,
  listStatuses,
  listTaskTypes,
  searchClientsForPartner,
} from "@/lib/workflow";
import type { WorkflowCustomer } from "@/types/workflow";

// Server entry point for the per-user Work Item board. Identity is resolved
// strictly from the logged-in session's email, matched (case-insensitively)
// against staff.email -- the same email a person's XPM user record uses, so
// the two are expected to already line up. The board itself is scoped by
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

  // Reference data for the "+ New Task" modal -- small datasets (single-digit
  // partners/managers, under 100 clients today), fetched up front
  // server-side, so the modal never has to refetch on open. Started
  // alongside the staff lookup rather than after it: none of it depends on
  // which staff member the session resolves to.
  const [sessionStaff, staffForForm, partners, statuses, taskTypes] = await Promise.all([
    session?.user?.email ? getStaffByEmail(session.user.email) : Promise.resolve(null),
    listStaff(),
    getPartners(),
    listStatuses(),
    listTaskTypes(),
  ]);

  // Only admins get the staff-switcher, so only they receive the roster as
  // `allStaff`; everyone else's switcher is absent and the list stays empty.
  // Filtered by the Settings → Included staff toggle, unlike `staffForForm`
  // below: someone excluded from reporting can still be *assigned* work, so
  // the "+ New Task" assignee picker deliberately keeps everyone.
  const allStaff = isAdmin ? staffForForm.filter((s) => s.included) : [];
  const activeStaff = sessionStaff ?? (isAdmin ? allStaff[0] ?? null : null);
  const tasks = activeStaff ? await getWorkBoardForStaff(activeStaff) : [];

  // Admins keep the full practice-wide client list (they can create/
  // reassign on any client, no restriction). Everyone else's "+ New Task"
  // client picker is pre-scoped server-side to what they're actually
  // allowed to create on -- getClientsInScopeForStaff mirrors the
  // create-route's own permission check, so a non-admin never even sees a
  // client they'd be rejected for.
  let allClients: WorkflowCustomer[];
  if (isAdmin) {
    const clientsByPartner = await Promise.all(partners.map((p) => searchClientsForPartner(p.id)));
    const clientsById = new Map<string, WorkflowCustomer>();
    for (const clients of clientsByPartner) for (const client of clients) clientsById.set(client.id, client);
    allClients = Array.from(clientsById.values());
  } else {
    allClients = activeStaff ? await getClientsInScopeForStaff(activeStaff) : [];
  }

  return (
    <MyWorkPageClient
      allStaff={allStaff}
      isAdmin={isAdmin}
      hasSessionMatch={Boolean(sessionStaff)}
      defaultStaffId={activeStaff?.id ?? null}
      defaultStaffName={activeStaff?.name ?? null}
      initialTasks={tasks}
      clients={allClients}
      staffOptions={staffForForm}
      statuses={statuses}
      taskTypes={taskTypes}
    />
  );
}
