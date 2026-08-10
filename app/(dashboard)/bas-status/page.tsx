import { auth } from "@/auth";
import BasStatusPageClient from "./BasStatusPageClient";
import { getAllTasks, getBasStageHistoryForTasks, listStaff } from "@/lib/workflow";
import { BAS_TASK_TYPE_ID } from "@/lib/workOverview";

// Server entry point for the BAS/IAS approval-pipeline board -- see
// migration 022/023 and lib/workflow.ts's setBasStage. Practice-wide (every
// BAS/IAS task, regardless of who owns it), the same way /clients is
// practice-wide -- filtering down to one employee is a client-side control
// on the board itself, not a server-side scope restriction, since Steve (the
// approver) needs to see every client's queue, not just his own.
export default async function BasStatusPage() {
  const session = await auth();
  const isAdmin = session?.user?.role === "admin";

  const [allTasks, staff] = await Promise.all([getAllTasks(), listStaff()]);
  const basTasks = allTasks.filter((t) => t.typeId === BAS_TASK_TYPE_ID);
  const historyByTaskId = await getBasStageHistoryForTasks(basTasks.map((t) => t.id));
  const initialHistory = Object.fromEntries(historyByTaskId);

  return (
    <BasStatusPageClient
      initialTasks={basTasks}
      staff={staff}
      isAdmin={isAdmin}
      initialHistory={initialHistory}
    />
  );
}
