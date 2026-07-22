import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getStaffByEmail, getWorkBoardForStaff, listStaff } from "@/lib/workflow";

// Only admins may request another staff member's board (the QA/"viewing
// as" override on /my-work) -- everyone else's session-linked staff record
// is the only board they can ever fetch, matched by email server-side so a
// non-admin can't request an arbitrary staffId.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  const requestedStaffId = request.nextUrl.searchParams.get("staffId");

  if (requestedStaffId) {
    if (!isAdmin) {
      return NextResponse.json({ error: "Admin role required to view another staff member's board" }, { status: 403 });
    }
    const staff = (await listStaff()).find((s) => s.id === requestedStaffId);
    if (!staff) {
      return NextResponse.json({ error: "Staff not found" }, { status: 404 });
    }
    const tasks = await getWorkBoardForStaff(staff);
    return NextResponse.json({ tasks });
  }

  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 404 });
  }
  const tasks = await getWorkBoardForStaff(staff);
  return NextResponse.json({ tasks });
}
