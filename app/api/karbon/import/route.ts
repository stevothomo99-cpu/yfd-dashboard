import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createTask } from "@/lib/workflow";
import type { RecurrenceInterval } from "@/types/workflow";

interface ImportRowInput {
  workItemKey?: unknown;
  title?: unknown;
  customerId?: unknown;
  assigneeId?: unknown;
  statusId?: unknown;
  typeId?: unknown;
  dueDate?: unknown;
  startDate?: unknown;
  recurrence?: unknown;
  karbonClientName?: unknown;
}

const RECURRENCE_VALUES: readonly RecurrenceInterval[] = ["none", "daily", "weekly", "fortnightly", "monthly", "quarterly"];

function isRecurrenceInterval(v: unknown): v is RecurrenceInterval {
  return typeof v === "string" && (RECURRENCE_VALUES as readonly string[]).includes(v);
}

function str(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

// Concurrency-limited rather than one big Promise.all -- this is a one-off
// bulk import that can run to hundreds of rows, and hammering Supabase with
// every insert at once risks connection-pool errors on rows that would
// otherwise succeed just fine a moment later.
const CONCURRENCY = 8;

async function runBatched<T, R>(items: T[], worker: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker_() {
    while (next < items.length) {
      const i = next++;
      results[i] = await worker(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, worker_));
  return results;
}

// Admin-only, same gate as the preview route this follows -- this is the
// action that actually writes tasks, so it re-checks independently rather
// than trusting that only the mapping page ever calls it.
export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "admin") {
    return NextResponse.json({ error: "Admins only" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json({ error: "Expected { rows: [...] }" }, { status: 400 });
  }

  const rows = body.rows as ImportRowInput[];
  const skipped: string[] = [];
  const failed: string[] = [];
  let created = 0;

  const importable = rows.filter((row) => {
    const label = str(row.workItemKey) ?? str(row.title) ?? "unknown row";
    const customerId = str(row.customerId);
    const statusId = str(row.statusId);
    if (!customerId || !statusId) {
      skipped.push(label);
      return false;
    }
    return true;
  });

  await runBatched(importable, async (row) => {
    const label = str(row.workItemKey) ?? str(row.title) ?? "unknown row";
    const result = await createTask({
      customerId: str(row.customerId)!,
      title: str(row.title) ?? "(untitled)",
      assigneeId: str(row.assigneeId),
      dueDate: str(row.dueDate),
      startDate: str(row.startDate),
      statusId: str(row.statusId)!,
      typeId: str(row.typeId),
      recurrence: isRecurrenceInterval(row.recurrence) ? row.recurrence : "none",
      karbonClientName: str(row.karbonClientName),
    });
    if (result) created++;
    else failed.push(label);
  });

  return NextResponse.json({ created, skipped, failed });
}
