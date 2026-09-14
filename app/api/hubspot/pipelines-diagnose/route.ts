import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getHubSpotPipelinesWithStages } from "@/lib/hubspot";

// One-off diagnostic, not a permanent feature -- lists every HubSpot deal
// pipeline with its stages (id/label/displayOrder/isClosed/probability) so
// the Business KPIs tile's pipeline split and stage-matching (currently
// broken -- see app/api/hubspot/deals/route.ts's TODO) can be wired up
// against real ids instead of guessed string labels. Admin-only, same gate
// as every other Karbon/Xero diagnostic in this app.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  try {
    const pipelines = await getHubSpotPipelinesWithStages();
    return NextResponse.json({ pipelines });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 502 }
    );
  }
}
