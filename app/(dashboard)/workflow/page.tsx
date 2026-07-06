import WorkflowPageClient from "./WorkflowPageClient";
import { loadWorkflowSnapshot } from "@/lib/workflow";

export default async function WorkflowPage() {
  const snapshot = await loadWorkflowSnapshot();
  return <WorkflowPageClient initial={snapshot} />;
}
