import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { StaffMember } from "@/types/dashboard";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const AUD = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

export function fmtCurrency(value: number): string {
  return AUD.format(value);
}

export function fmtCompact(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return "$" + (value / 1_000_000).toFixed(2) + "m";
  }
  if (Math.abs(value) >= 1_000) {
    return "$" + (value / 1_000).toFixed(1) + "k";
  }
  return "$" + value.toFixed(0);
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function fyYearFor(date: Date): number {
  const m = date.getMonth();
  const y = date.getFullYear();
  return m >= 6 ? y + 1 : y;
}

export function fyLabel(fyYear: number): string {
  return "FY" + String(fyYear).slice(-2);
}

export function fyRange(fyYear: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(fyYear - 1, 6, 1)),
    end: new Date(Date.UTC(fyYear, 5, 30, 23, 59, 59)),
  };
}

export type ChurnRange = "all" | "12m" | "fy" | "month" | "week" | "24h";

export function getRangeStart(range: ChurnRange, now: Date): Date | null {
  switch (range) {
    case "all":
      return null;
    case "12m": {
      const d = new Date(now);
      d.setMonth(d.getMonth() - 12);
      return d;
    }
    case "fy":
      return fyRange(fyYearFor(now)).start;
    case "month":
      return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
    case "week": {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const day = d.getDay(); // 0 = Sunday, 1 = Monday, ...
      const diffToMonday = day === 0 ? 6 : day - 1;
      d.setDate(d.getDate() - diffToMonday);
      return d;
    }
    case "24h":
      return new Date(now.getTime() - 24 * 60 * 60 * 1000);
  }
}

// Builds a minimal display-only StaffMember list from anything carrying an
// assigneeId/assigneeName — used to drive StaffSlicer on pages backed by
// live Karbon data, where full XPM-derived staff stats aren't available.
export function staffFromAssignees<T extends { assigneeId: string; assigneeName: string }>(
  items: T[],
): StaffMember[] {
  const seen = new Map<string, StaffMember>();
  for (const item of items) {
    if (!item.assigneeId || seen.has(item.assigneeId)) continue;
    seen.set(item.assigneeId, {
      id: item.assigneeId,
      name: item.assigneeName || "Unassigned",
      initials: initialsOf(item.assigneeName || "??"),
      xpmRole: "Manager",
      score: 0,
      billableHours: 0,
      nonBillableHours: 0,
      billablePct: 0,
      tasksDone: 0,
      tasksOverdue: 0,
      basOverdue: 0,
      dailyHours: [],
      included: true,
    });
  }
  return Array.from(seen.values()).sort((a, b) => a.name.localeCompare(b.name));
}
