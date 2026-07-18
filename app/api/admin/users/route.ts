import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { getSupabaseAdmin } from "@/lib/supabase";

interface CreateUserRequest {
  email: string;
  username: string;
  password: string;
  role?: "admin" | "user";
}

async function requireAdmin(): Promise<
  { ok: true; actor: string } | { ok: false; response: NextResponse }
> {
  const session = await auth();
  if (!session?.user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Not authenticated" }, { status: 401 }),
    };
  }
  if (session.user.role !== "admin") {
    return {
      ok: false,
      response: NextResponse.json({ error: "Admin role required" }, { status: 403 }),
    };
  }
  return { ok: true, actor: session.user.email ?? session.user.name ?? session.user.id ?? "unknown" };
}

export async function POST(request: NextRequest) {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const { email, username, password, role = "user" } = (await request.json()) as CreateUserRequest;

    if (!email || !username || !password) {
      return NextResponse.json(
        { error: "Email, username, and password are required" },
        { status: 400 }
      );
    }

    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });

    if (error) {
      console.error(`[admin/users] ${admin.actor} failed to create user ${email}:`, error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    const { error: profileError } = await supabaseAdmin
      .from("dashboard_users")
      .insert([
        {
          id: data.user.id,
          email,
          username,
          role,
        },
      ]);

    if (profileError) {
      console.error(`[admin/users] ${admin.actor} failed to create profile for ${email}:`, profileError.message);
      return NextResponse.json(
        { error: profileError.message },
        { status: 400 }
      );
    }

    console.log(`[admin/users] ${admin.actor} created user ${email} (role: ${role})`);

    return NextResponse.json({
      user: {
        id: data.user.id,
        email,
        username,
        role,
      },
    });
  } catch (err) {
    console.error(`[admin/users] ${admin.actor} error creating user:`, err);
    return NextResponse.json(
      { error: "Failed to create user" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const admin = await requireAdmin();
  if (!admin.ok) return admin.response;

  try {
    const supabaseAdmin = getSupabaseAdmin();

    const { data, error } = await supabaseAdmin
      .from("dashboard_users")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error(`[admin/users] ${admin.actor} failed to list users:`, error.message);
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    return NextResponse.json({ users: data });
  } catch (err) {
    console.error(`[admin/users] ${admin.actor} error fetching users:`, err);
    return NextResponse.json(
      { error: "Failed to fetch users" },
      { status: 500 }
    );
  }
}
