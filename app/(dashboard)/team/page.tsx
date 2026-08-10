import PageHeader from "@/components/dashboard/PageHeader";
import ScoreBadge from "@/components/dashboard/ScoreBadge";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { initialsOf } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { listStaff, getAllTasks } from "@/lib/workflow";
import { computeWagesUtilisation, type WagesUtilisationResult } from "@/lib/workOverview";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";
import { computeStaffStats } from "@/lib/leaderboard";
import type { TaskWithDetails } from "@/types/workflow";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Merged /team + /leaderboard (formerly two separate 100%-Karbon/mock
// pages -- see CONTEXT.md §0). Real staff/tasks from Supabase, real
// billable-hours-against-capacity from XPM timesheets -- the full 50%
// billable / 30% task completion / 20% BAS on-time formula, not the old
// 60/40 partial one.
export default async function TeamPage() {
  const [staff, allTasks, settings] = await Promise.all([listStaff(), getAllTasks(), getSettings()]);

  const today = todayIso();
  const rankedStaff = staff.filter((s) => s.included && s.role !== "Partner");

  const tasksByStaffId = new Map<string, TaskWithDetails[]>();
  for (const task of allTasks) {
    if (!task.assigneeId) continue;
    const list = tasksByStaffId.get(task.assigneeId);
    if (list) list.push(task);
    else tasksByStaffId.set(task.assigneeId, [task]);
  }

  const { utilisationByXpmStaffId, message } = await loadUtilisation(rankedStaff, settings.partnerName, today);

  const rows = computeStaffStats(rankedStaff, tasksByStaffId, utilisationByXpmStaffId).sort(
    (a, b) => b.score - a.score,
  );

  return (
    <div>
      <PageHeader
        title="Team"
        subtitle="Score — 50% billable hours (against capacity), 30% task completion, 20% BAS on-time. A component with no data for a person drops out and the rest is reweighted."
      />

      {message ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "14px",
          }}
        >
          {message}
        </div>
      ) : null}

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "48px 1.4fr 110px 100px 110px 100px 90px",
            padding: "12px 16px",
            background: "#fafaf8",
            borderBottom: "0.5px solid #e1e0d9",
            fontSize: "11px",
            fontWeight: 500,
            color: "#888780",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <div>Rank</div>
          <div>Staff</div>
          <div style={{ textAlign: "right" }}>Tasks done</div>
          <div style={{ textAlign: "right" }}>Overdue</div>
          <div style={{ textAlign: "right" }}>BAS on-time</div>
          <div style={{ textAlign: "right" }}>Billable %</div>
          <div style={{ textAlign: "right" }}>Score</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "24px 16px", fontSize: "12px", color: "#888780" }}>
            No staff found.
          </div>
        ) : (
          rows.map((s, i) => (
            <div
              key={s.id}
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1.4fr 110px 100px 110px 100px 90px",
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: i < rows.length - 1 ? "0.5px solid #e1e0d9" : "none",
              }}
            >
              <div style={{ fontSize: "13px", color: "#888780", fontWeight: 500 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <StaffAvatar initials={initialsOf(s.name)} size={32} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>{s.name}</div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: 2 }}>
                    {s.totalTasks} tasks · {s.basCompletedTotal} BAS completed
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "13px", color: "#111111", textAlign: "right" }}>
                {s.tasksDone}/{s.totalTasks}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: s.tasksOverdue > 0 ? "#A32D2D" : "#888780",
                  textAlign: "right",
                  fontWeight: s.tasksOverdue > 0 ? 600 : 400,
                }}
              >
                {s.tasksOverdue}
              </div>
              <div style={{ fontSize: "13px", color: "#111111", textAlign: "right" }}>
                {s.basOnTimeRate !== null ? `${s.basOnTimeRate}%` : "—"}
              </div>
              <div style={{ fontSize: "13px", color: "#111111", textAlign: "right" }}>
                {s.billableCapacityPct !== null ? `${s.billableCapacityPct}%` : "N/A"}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ScoreBadge score={s.score} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

async function loadUtilisation(
  rankedStaff: { xpmStaffId: string | null }[],
  partnerName: string,
  today: string,
): Promise<{ utilisationByXpmStaffId: Map<string, WagesUtilisationResult>; message: string | null }> {
  const utilisationByXpmStaffId = new Map<string, WagesUtilisationResult>();

  if (!isXpmConfigured()) {
    return { utilisationByXpmStaffId, message: "XPM isn't configured (XPM_CLIENT_ID etc. not set) -- billable % is unavailable." };
  }
  if (!partnerName) {
    return { utilisationByXpmStaffId, message: "Set a Partner name in Settings to sync XPM timesheets -- billable % is unavailable." };
  }

  try {
    const timesheets = await getXpmTimesheets(partnerName);
    for (const s of rankedStaff) {
      if (!s.xpmStaffId) continue;
      utilisationByXpmStaffId.set(
        s.xpmStaffId,
        computeWagesUtilisation(timesheets, [s.xpmStaffId], "month", today),
      );
    }
    return { utilisationByXpmStaffId, message: null };
  } catch (err) {
    return {
      utilisationByXpmStaffId,
      message: err instanceof Error ? err.message : "Failed to load timesheets from XPM -- billable % is unavailable.",
    };
  }
}
