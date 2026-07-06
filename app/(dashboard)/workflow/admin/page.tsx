import AdminPageClient from "./AdminPageClient";
import { listStatuses, listTaskTypes, isWorkflowConfigured } from "@/lib/workflow";
import { WORKFLOW_STATUSES, WORKFLOW_TASK_TYPES } from "@/lib/mock";
import type { WorkflowStatus, WorkflowTaskType } from "@/types/workflow";

export interface AdminSnapshot {
  mode: "live" | "mock";
  statuses: WorkflowStatus[];
  taskTypes: WorkflowTaskType[];
  message?: string;
}

async function loadAdminSnapshot(): Promise<AdminSnapshot> {
  if (!isWorkflowConfigured()) {
    return {
      mode: "mock",
      statuses: WORKFLOW_STATUSES,
      taskTypes: WORKFLOW_TASK_TYPES,
      message: "Showing mock data — changes here won't persist until SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are set.",
    };
  }
  try {
    const [statuses, taskTypes] = await Promise.all([listStatuses(), listTaskTypes()]);
    return { mode: "live", statuses, taskTypes };
  } catch (err) {
    return {
      mode: "live",
      statuses: [],
      taskTypes: [],
      message: err instanceof Error ? err.message : "Unknown error",
    };
  }
}

export default async function WorkflowAdminPage() {
  const snapshot = await loadAdminSnapshot();
  return <AdminPageClient initial={snapshot} />;
}
