import type { TaskRecurrence } from "@/types/workflow";

// Generate-on-completion: the next instance is created only when the
// current one is marked complete, anchored off its own due date (not
// "today") so a task completed late doesn't shift the whole series.
export function nextDueDate(dueDate: string, recurrence: TaskRecurrence): string | null {
  if (recurrence === "none") return null;
  const d = new Date(dueDate + "T00:00:00Z");
  switch (recurrence) {
    case "daily":
      d.setUTCDate(d.getUTCDate() + 1);
      break;
    case "weekly":
      d.setUTCDate(d.getUTCDate() + 7);
      break;
    case "fortnightly":
      d.setUTCDate(d.getUTCDate() + 14);
      break;
    case "monthly":
      d.setUTCMonth(d.getUTCMonth() + 1);
      break;
    case "quarterly":
      d.setUTCMonth(d.getUTCMonth() + 3);
      break;
  }
  return d.toISOString().slice(0, 10);
}

export const RECURRENCE_LABELS: Record<TaskRecurrence, string> = {
  none: "One-off",
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};
