import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getTasksForStaff } from "@/lib/workflow";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const staffId = request.nextUrl.searchParams.get("staffId");
  if (!staffId) {
    return NextResponse.json({ error: "staffId is required" }, { status: 400 });
  }

  const tasks = await getTasksForStaff(staffId);
  return NextResponse.json({ tasks });
}
