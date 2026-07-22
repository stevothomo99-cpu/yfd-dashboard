import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getInProgressJobsForPartner } from "@/lib/workflow";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const partnerId = request.nextUrl.searchParams.get("partnerId");
  if (!partnerId) {
    return NextResponse.json({ error: "partnerId is required" }, { status: 400 });
  }

  const jobs = await getInProgressJobsForPartner(partnerId);
  return NextResponse.json({ jobs });
}
