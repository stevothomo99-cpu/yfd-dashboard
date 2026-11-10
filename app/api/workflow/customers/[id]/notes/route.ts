import { NextResponse, NextRequest } from "next/server";
import { addCustomerNote, getCustomerNotes } from "@/lib/workflow";
import { authorizeClientAccess } from "@/lib/routeAuth";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const notes = await getCustomerNotes(id);
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const body = (await request.json()) as { body?: string; title?: string };
  const text = body.body?.trim();
  if (!text) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }
  const title = body.title?.trim() || null;

  const authorName = authz.session.user.name ?? authz.session.user.email ?? "Unknown";
  const note = await addCustomerNote(id, authorName, authz.session.user.email ?? null, text, title);
  if (!note) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
  return NextResponse.json({ note });
}
