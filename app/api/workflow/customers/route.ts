import { NextResponse } from "next/server";
import { listCustomers, createCustomer, isWorkflowConfigured } from "@/lib/workflow";
import { WORKFLOW_CUSTOMERS } from "@/lib/mock";

export async function GET() {
  if (!isWorkflowConfigured()) {
    return NextResponse.json({ mode: "mock", customers: WORKFLOW_CUSTOMERS });
  }
  try {
    const customers = await listCustomers();
    return NextResponse.json({ mode: "live", customers });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ mode: "live", customers: [], message }, { status: 502 });
  }
}

export async function POST(request: Request) {
  if (!isWorkflowConfigured()) {
    return NextResponse.json(
      { message: "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set." },
      { status: 503 },
    );
  }
  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ message: "Customer name is required." }, { status: 400 });
  }
  const partnerId = typeof body.partnerId === "string" ? body.partnerId : null;
  try {
    const customer = await createCustomer(name, partnerId);
    return NextResponse.json({ customer }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ message }, { status: 502 });
  }
}
