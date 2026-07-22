import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getJobsForCustomer } from "@/lib/workflow";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const jobs = await getJobsForCustomer(id);
  return NextResponse.json({ jobs });
}
