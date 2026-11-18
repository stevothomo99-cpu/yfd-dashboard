import { NextResponse, NextRequest } from "next/server";
import { addCustomerNote, getCustomerNotes, uploadCustomerFile } from "@/lib/workflow";
import { authorizeClientAccess } from "@/lib/routeAuth";

// Same limit as the standalone Files upload (files/route.ts) -- a note's
// attachment goes through the exact same Storage bucket.
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const notes = await getCustomerNotes(id);
  return NextResponse.json({ notes });
}

// multipart/form-data rather than JSON -- a note can optionally carry one
// attached file (title/body fields, plus an optional `file`), not just
// plain text. The note is always saved even if the attachment fails, so a
// Storage hiccup never loses what was actually typed.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const bodyField = formData.get("body");
  const text = typeof bodyField === "string" ? bodyField.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "Note body is required" }, { status: 400 });
  }
  const titleField = formData.get("title");
  const title = typeof titleField === "string" && titleField.trim() ? titleField.trim() : null;

  const file = formData.get("file");
  if (file instanceof File && file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 20MB limit" }, { status: 413 });
  }

  const authorName = authz.session.user.name ?? authz.session.user.email ?? "Unknown";
  const authorEmail = authz.session.user.email ?? null;
  const note = await addCustomerNote(id, authorName, authorEmail, text, title);
  if (!note) {
    return NextResponse.json({ error: "Failed to save note" }, { status: 500 });
  }

  if (file instanceof File) {
    const uploaded = await uploadCustomerFile(id, file, authorName, authorEmail, note.id);
    if (!uploaded) {
      return NextResponse.json({ note, warning: "Note saved, but the file attachment failed to upload." });
    }
    note.file = uploaded;
  }

  return NextResponse.json({ note });
}
