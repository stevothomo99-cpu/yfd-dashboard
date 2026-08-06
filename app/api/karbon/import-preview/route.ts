import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { fetchKarbonWorkItemsSample, isKarbonConfigured, KarbonNotConfiguredError } from "@/lib/karbon";
import { TASKS } from "@/lib/mock";

const SAMPLE_SIZE = 5;

interface ResponseBody {
  mode: "live" | "mock";
  rows: Record<string, unknown>[];
  message?: string;
}

// Karbon's raw field names, built from the same mock tasks the rest of the
// app falls back to when KARBON_API_KEY is unset -- so the mapping page has
// something plausible to render even without live access.
function mockRows(): Record<string, unknown>[] {
  return TASKS.slice(0, SAMPLE_SIZE).map((t) => ({
    WorkItemKey: t.id,
    Title: t.title,
    ClientKey: t.clientId,
    ClientName: t.clientName,
    AssigneeKey: t.assigneeId,
    AssigneeName: t.assigneeName,
    WorkType: t.category,
    DueDate: t.dueDate,
    PrimaryStatus: t.rawStatus,
  }));
}

// Admin-only, same as the Karbon Import page itself -- this is a review tool
// for setting up an import, not something every staff login needs.
export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  if (!isKarbonConfigured()) {
    return NextResponse.json({
      mode: "mock",
      rows: mockRows(),
      message: "Showing mock data because KARBON_API_KEY is not set.",
    } satisfies ResponseBody);
  }

  try {
    const rows = await fetchKarbonWorkItemsSample(SAMPLE_SIZE);
    return NextResponse.json({ mode: "live", rows } satisfies ResponseBody);
  } catch (err) {
    if (err instanceof KarbonNotConfiguredError) {
      return NextResponse.json({
        mode: "mock",
        rows: mockRows(),
        message: err.message,
      } satisfies ResponseBody);
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { mode: "live", rows: [], message } satisfies ResponseBody,
      { status: 502 },
    );
  }
}
