import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { copyTaskToJob } from "@/lib/workflow";

// Copies an existing task onto a (usually different) job/client -- see
// lib/workflow.ts's copyTaskToJob for exactly what is/isn't carried over.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { jobId?: string };
  const jobId = body.jobId?.trim();
  if (!jobId) {
    return NextResponse.json({ error: "jobId is required" }, { status: 400 });
  }

  const task = await copyTaskToJob(id, jobId);
  if (!task) {
    return NextResponse.json({ error: "Failed to copy task" }, { status: 500 });
  }
  return NextResponse.json({ task });
}
