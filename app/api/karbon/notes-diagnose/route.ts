import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { diagnoseClientNotes, isKarbonConfigured, KarbonNotConfiguredError } from "@/lib/karbon";

// One-off diagnostic, not a permanent feature -- answers "can we actually
// pull this client's notes/pinned items from Karbon's API" against the real
// tenant. See lib/karbon.ts's diagnoseClientNotes for what it tries and why.
// Admin-only, same gate as the Karbon Import page this reuses karbonFetch
// credentials from.
export async function GET(request: NextRequest) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const client = request.nextUrl.searchParams.get("client");
  if (!client) {
    return NextResponse.json({ error: "?client=<name or partial name> is required" }, { status: 400 });
  }

  if (!isKarbonConfigured()) {
    return NextResponse.json({ error: "KARBON_API_KEY is not set" }, { status: 500 });
  }

  try {
    const result = await diagnoseClientNotes(client);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
