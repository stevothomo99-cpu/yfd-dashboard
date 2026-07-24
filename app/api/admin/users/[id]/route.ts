import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { setUserSuspended, deleteDashboardUser } from "@/lib/supabase";

async function requireAdmin(): Promise<
  { ok: true; actorId: string; actorLabel: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return { ok: false, response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  if (session.user.role !== "admin") {
    return { ok: false, response: NextResponse.json({ error: "Admin role required" }, { status: 403 }) };
  }
  return {
    ok: true,
    actorId: session.user.id as string,
    actorLabel: session.user.email ?? session.user.name ?? session.user.id ?? "unknown",
  };
}

// Pauses or resumes a user's access -- reversible, doesn't touch their
// account/data at all (see lib/supabase.ts's setUserSuspended).
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (id === admin.actorId) {
    return NextResponse.json({ error: "You can't suspend your own account." }, { status: 400 });
  }

  const body = (await request.json()) as { suspended?: boolean };
  if (typeof body.suspended !== "boolean") {
    return NextResponse.json({ error: "suspended (boolean) is required" }, { status: 400 });
  }

  const ok = await setUserSuspended(id, body.suspended);
  if (!ok) {
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }

  console.log(`[admin/users] ${admin.actorLabel} ${body.suspended ? "paused" : "resumed"} user ${id}`);
  return NextResponse.json({ success: true });
}

// Fully removes a user -- both their dashboard profile and their
// underlying Supabase Auth account. Destructive; the client is expected to
// confirm with the operator before calling this.
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  const { id } = await params;
  if (id === admin.actorId) {
    return NextResponse.json({ error: "You can't remove your own account." }, { status: 400 });
  }

  const ok = await deleteDashboardUser(id);
  if (!ok) {
    return NextResponse.json({ error: "Failed to remove user" }, { status: 500 });
  }

  console.log(`[admin/users] ${admin.actorLabel} removed user ${id}`);
  return NextResponse.json({ success: true });
}
