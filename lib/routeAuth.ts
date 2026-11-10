import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canAccessClient, getStaffByEmail } from "@/lib/workflow";
import type { Session } from "next-auth";

// Shared by every route that reads/writes a single client's data (notes,
// files, jobs, tasks) -- same Partner/Manager/Staff scoping as task
// creation (see lib/workflow.ts's getClientsInScopeForStaff/canAccessClient).
// Kept as one function rather than copied into each route, since an
// inconsistent copy here is exactly how several routes ended up with no
// scope check at all (only "is there a session") -- a one-line "not
// authenticated" check felt like checking permission, but wasn't.
export async function authorizeClientAccess(customerId: string): Promise<{ session: Session } | NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  if (session.user.role === "admin") return { session };

  const staff = session.user.email ? await getStaffByEmail(session.user.email) : null;
  if (!staff) {
    return NextResponse.json({ error: "No staff record linked to your login email" }, { status: 403 });
  }
  if (!(await canAccessClient(staff, customerId))) {
    return NextResponse.json({ error: "You don't have permission to access that client" }, { status: 403 });
  }
  return { session };
}
