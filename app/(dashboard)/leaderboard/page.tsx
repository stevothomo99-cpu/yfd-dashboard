import PageHeader from "@/components/dashboard/PageHeader";
import ScoreBadge from "@/components/dashboard/ScoreBadge";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { initialsOf } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { loadDashboardKarbonData } from "@/lib/dashboardData";

export default async function LeaderboardPage() {
  const settings = await getSettings();
  const data = await loadDashboardKarbonData(settings.excludedStaffIds);
  const rows = [...data.stats].sort((a, b) => b.partialScore - a.partialScore);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Partial score — 60% task completion, 40% BAS on-time (from Karbon). Billable-hours weighting (50% of the full formula) is pending XPM."
      />

      {data.mode === "mock" ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          Showing mock data — {data.message ?? "Karbon is not configured."}
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
                    {s.totalTasks} tasks · {s.basTotal} BAS
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
                {s.basTotal > 0 ? `${s.basOnTimeRate}%` : "—"}
              </div>
              <div style={{ fontSize: "13px", color: "#888780", textAlign: "right" }}>
                N/A
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ScoreBadge score={s.partialScore} />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
