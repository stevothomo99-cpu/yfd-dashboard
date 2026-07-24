import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getStaffByEmail } from "@/lib/workflow";
import { listAllTodoItems, listTodoItemsForStaff } from "@/lib/todos";

// Admins see every pending/populated to-do practice-wide (same bypass
// pattern as everywhere else in this app); everyone else sees only their
// own -- these are personal reminders, not a shared work queue.
export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const isAdmin = session.user.role === "admin";
  if (isAdmin) {
    const todos = await listAllTodoItems();
    return NextResponse.json({ todos });
  }

  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
  }

  const todos = await listTodoItemsForStaff(staff.id);
  return NextResponse.json({ todos });
}
