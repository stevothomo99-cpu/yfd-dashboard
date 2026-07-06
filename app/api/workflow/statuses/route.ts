import { NextResponse } from "next/server";
import { listStatuses, isWorkflowConfigured } from "@/lib/workflow";
import { WORKFLOW_STATUSES } from "@/lib/mock";

export async function GET() {
  if (!isWorkflowConfigured()) {
    return NextResponse.json({ statuses: WORKFLOW_STATUSES });
  }
  try {
    const statuses = await listStatuses();
    return NextResponse.json({ statuses });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ statuses: [], message }, { status: 502 });
  }
}
