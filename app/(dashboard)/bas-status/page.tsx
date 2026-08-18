import { auth } from "@/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import BasStatusPageClient from "./BasStatusPageClient";
import {
  getAllTasks,
  getBasStageHistoryForTasks,
  getPartners,
  listStaff,
  listStatuses,
  listTaskTypes,
  searchClientsForPartner,
} from "@/lib/workflow";
import { BAS_TASK_TYPE_ID } from "@/lib/workOverview";
import type { WorkflowCustomer } from "@/types/workflow";

// Server entry point for the BAS/IAS approval-pipeline board -- see
// migration 022/023 and lib/workflow.ts's setBasStage. Practice-wide (every
// BAS/IAS task, regardless of who owns it), the same way /clients is
// practice-wide -- filtering down to one employee is a client-side control
// on the board itself, not a server-side scope restriction, since Steve (the
// approver) needs to see every client's queue, not just his own.
export default async function BasStatusPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  // Self-gated the same way /settings/karbon-import is -- nav-gated only
  // otherwise, so this doesn't add a new pattern. Every stage-change action
  // still goes through the same per-task canModifyTask check as editing that
  // task normally would.
  if (!isAdmin) {
    return (
      <div>
        <PageHeader title="BAS Status" />
        <div style={{ fontSize: "13px", color: "#888780" }}>Admins only.</div>
      </div>
    );
  }

  const [allTasks, staff, partners, statuses, taskTypes] = await Promise.all([
    getAllTasks(),
    listStaff(),
    getPartners(),
    listStatuses(),
    listTaskTypes(),
  ]);
  const basTasks = allTasks.filter((t) => t.typeId === BAS_TASK_TYPE_ID);
  const historyByTaskId = await getBasStageHistoryForTasks(basTasks.map((t) => t.id));
  const initialHistory = Object.fromEntries(historyByTaskId);

  // Same practice-wide client list My Work gives an admin -- the task modal
  // opened from a BAS card needs every client available, not just one
  // partner's, since this board itself is already practice-wide.
  const clientsByPartner = await Promise.all(partners.map((p) => searchClientsForPartner(p.id)));
  const clientsById = new Map<string, WorkflowCustomer>();
  for (const clients of clientsByPartner) for (const client of clients) clientsById.set(client.id, client);
  const allClients = Array.from(clientsById.values());

  return (
    <BasStatusPageClient
      initialTasks={basTasks}
      staff={staff}
      isAdmin={isAdmin}
      initialHistory={initialHistory}
      clients={allClients}
      statuses={statuses}
      taskTypes={taskTypes}
    />
  );
}
