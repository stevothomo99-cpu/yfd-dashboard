import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { addCustomerNote, getCustomerNotes } from "@/lib/workflow";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const notes = await getCustomerNotes(id);
  return NextResponse.json({ notes });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { body?: string };
  const text = body.body?.trim();
  if (!text) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }

  const authorName = session.user.name ?? session.user.email ?? "Unknown";
  const note = await addCustomerNote(id, authorName, session.user.email ?? null, text);
  if (!note) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }
  return NextResponse.json({ note });
}
