import { NextResponse } from "next/server";
import { listJobs, createJob, isWorkflowConfigured } from "@/lib/workflow";
import { WORKFLOW_JOBS } from "@/lib/mock";
import type { CreateJobInput } from "@/types/workflow";

export async function GET() {
  if (!isWorkflowConfigured()) {
    return NextResponse.json({ mode: "mock", jobs: WORKFLOW_JOBS });
  }
  try {
    const jobs = await listJobs();
    return NextResponse.json({ mode: "live", jobs });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ mode: "live", jobs: [], message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const body = await request.json();
  const customerId = typeof body.customerId === "string" ? body.customerId : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!customerId || !name) {
    return NextResponse.json({ message: "customerId and name are required." }, { status: 400 });
  }
  const input: CreateJobInput = {
    customerId,
    name,
    partnerId: typeof body.partnerId === "string" ? body.partnerId : null,
    managerId: typeof body.managerId === "string" ? body.managerId : null,
  };
  try {
    const job = await createJob(input);
    return NextResponse.json({ job }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
