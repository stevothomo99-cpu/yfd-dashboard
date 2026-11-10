import { NextResponse, NextRequest } from "next/server";
import { getCustomerFiles, uploadCustomerFile } from "@/lib/workflow";
import { authorizeClientAccess } from "@/lib/routeAuth";

const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const files = await getCustomerFiles(id);
  return NextResponse.json({ files });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const authz = await authorizeClientAccess(id);
  if (authz instanceof NextResponse) return authz;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required" }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return NextResponse.json({ error: "File exceeds the 20MB limit" }, { status: 413 });
  }

  const uploadedByName = authz.session.user.name ?? authz.session.user.email ?? "Unknown";
  const uploaded = await uploadCustomerFile(id, file, uploadedByName, authz.session.user.email ?? null);
  if (!uploaded) {
    return NextResponse.json({ error: "Failed to upload file" }, { status: 500 });
  }
  return NextResponse.json({ file: uploaded });
}
