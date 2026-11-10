import { NextResponse, NextRequest } from "next/server";
import { getTasksForCustomer } from "@/lib/workflow";
import { authorizeClientAccess } from "@/lib/routeAuth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const tasks = await getTasksForCustomer(id);
  return NextResponse.json({ tasks });
}
