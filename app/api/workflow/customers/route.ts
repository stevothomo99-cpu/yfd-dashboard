import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createCustomer, getPartners } from "@/lib/workflow";

// Admin-only, same gate as the Karbon Import page this backs -- creates a
// bare client with no XPM linkage, for a Karbon work item whose client
// genuinely doesn't exist in XPM yet.
export async function POST(request: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Client name is required" }, { status: 400 });
  }

  const [partner] = await getPartners();
  if (!partner) {
    return NextResponse.json({ error: "No Partner is configured in Settings" }, { status: 400 });
  }

  const customer = await createCustomer(name, partner.id);
  if (!customer) {
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
  return NextResponse.json({ customer });
}
