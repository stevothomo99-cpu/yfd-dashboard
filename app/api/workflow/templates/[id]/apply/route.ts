import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { applyTemplateToClient } from "@/lib/workflow";

// Bulk-creates fresh tasks on a destination client from a saved template's
// items -- see lib/workflow.ts's applyTemplateToClient for exactly what
// is/isn't carried over.
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { id } = await params;
  const body = (await request.json()) as { customerId?: string };
  const customerId = body.customerId?.trim();
  if (!customerId) {
    return NextResponse.json({ error: "customerId is required" }, { status: 400 });
  }

  const result = await applyTemplateToClient(id, customerId);
  if (!result) {
    return NextResponse.json({ error: "Failed to apply template" }, { status: 500 });
  }
  return NextResponse.json(result);
}
