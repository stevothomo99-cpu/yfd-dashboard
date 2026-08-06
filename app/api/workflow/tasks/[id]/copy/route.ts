import { NextResponse, NextRequest } from "next/server";
import { auth } from "@/auth";
import { copyTaskToClient } from "@/lib/workflow";

// Copies an existing task onto a (usually different) client -- see
// lib/workflow.ts's copyTaskToClient for exactly what is/isn't carried over.
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

  const task = await copyTaskToClient(id, customerId);
  if (!task) {
    return NextResponse.json({ error: "Failed to copy task" }, { status: 500 });
  }
  return NextResponse.json({ task });
}
