import Link from "next/link";
import { notFound } from "next/navigation";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import ScoreBadge from "@/components/dashboard/ScoreBadge";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import BasStatusBadge from "@/components/dashboard/BasStatusBadge";
import TaskRow from "@/components/dashboard/TaskRow";
import DailyHoursChart from "@/components/charts/DailyHoursChart";
import { findStaff, TASKS, CLIENT_TILES } from "@/lib/mock";

const WEEKLY_TARGET = 24;

export default async function StaffDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const staff = findStaff(id);
  if (!staff) notFound();

  const tasks = TASKS.filter((t) => t.assigneeId === id);
  const overdueTasks = tasks.filter((t) => t.isOverdue);
  const upcomingTasks = tasks.filter((t) => !t.isOverdue && t.status !== "complete");
  const completedTasks = tasks.filter((t) => t.status === "complete");
  const basAssignments = CLIENT_TILES.filter((c) => c.managerId === id);

  const totalHours = staff.billableHours + staff.nonBillableHours;
  const billableW = Math.min((staff.billableHours / WEEKLY_TARGET) * 100, 100);
  const nonBillableW = Math.min((staff.nonBillableHours / WEEKLY_TARGET) * 100, 100 - billableW);

  return (
    <div>
      <Link
        href="/leaderboard"
        style={{
          fontSize: "12px",
          color: "#0C447C",
          textDecoration: "none",
          display: "inline-flex",
          alignItems: "center",
          gap: "4px",
          marginBottom: "12px",
        }}
      >
        ← Back to leaderboard
      </Link>

      <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
        <StaffAvatar initials={staff.initials} size={48} />
        <div style={{ flex: 1 }}>
          <PageHeader
            title={staff.name}
            subtitle={staff.xpmRole + " · YFD overseas team"}
            action={<ScoreBadge score={staff.score} />}
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(5, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
          marginTop: "14px",
        }}
      >
        <KpiCard
          label="Score"
          value={String(staff.score)}
          sub="Composite (0–100)"
          valueColor="#2a78d6"
        />
        <KpiCard
          label="Billable hrs"
          value={staff.billableHours.toFixed(1)}
          sub={staff.billablePct + "% of total"}
        />
        <KpiCard label="Tasks done" value={String(staff.tasksDone)} sub="Last 7 days" />
        <KpiCard
          label="Tasks overdue"
          value={String(staff.tasksOverdue)}
          valueColor={staff.tasksOverdue > 0 ? "#e24b4a" : "#111111"}
          sub="Past due date"
        />
        <KpiCard
          label="BAS overdue"
          value={String(staff.basOverdue)}
          valueColor={staff.basOverdue > 0 ? "#e24b4a" : "#111111"}
          sub="Assigned to you"
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <div
          style={{
            background: "white",
            border: "0.5px solid #e1e0d9",
            borderRadius: "14px",
            padding: "1.1rem 1.2rem",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "14px" }}>
            Hours breakdown · this week
          </div>
          <div style={{ marginBottom: "14px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                marginBottom: "6px",
              }}
            >
              <span style={{ color: "#444441" }}>
                {totalHours.toFixed(1)}h of {WEEKLY_TARGET}h target
              </span>
              <span style={{ color: "#888780" }}>
                Utilisation {Math.round((totalHours / WEEKLY_TARGET) * 100)}%
              </span>
            </div>
            <div
              style={{
                height: "12px",
                background: "#f5f4f0",
                borderRadius: "6px",
                overflow: "hidden",
                display: "flex",
              }}
            >
              <div style={{ width: billableW + "%", background: "#2a78d6" }} />
              <div style={{ width: nonBillableW + "%", background: "#888780" }} />
            </div>
          </div>
          <Legend rows={[
            { color: "#2a78d6", label: "Billable", value: staff.billableHours.toFixed(1) + "h" },
            { color: "#888780", label: "Non-billable", value: staff.nonBillableHours.toFixed(1) + "h" },
            { color: "#b4b2a9", label: "Available (target)", value: WEEKLY_TARGET + "h" },
          ]} />
        </div>

        <DailyHoursChart daily={staff.dailyHours} />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "14px",
        }}
      >
        <div
          style={{
            background: "white",
            border: "0.5px solid #e1e0d9",
            borderRadius: "14px",
            padding: "1.1rem 1.2rem",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "12px" }}>
            Tasks
          </div>
          <SectionList label={`Overdue · ${overdueTasks.length}`}>
            {overdueTasks.length === 0 ? (
              <Empty />
            ) : (
              overdueTasks.map((t) => <TaskRow key={t.id} task={t} accent="overdue" showAssignee={false} />)
            )}
          </SectionList>
          <SectionList label={`Upcoming · ${upcomingTasks.length}`}>
            {upcomingTasks.length === 0 ? (
              <Empty />
            ) : (
              upcomingTasks.map((t) => <TaskRow key={t.id} task={t} accent="week" showAssignee={false} />)
            )}
          </SectionList>
          <SectionList label={`Completed · ${completedTasks.length}`}>
            {completedTasks.length === 0 ? (
              <Empty />
            ) : (
              completedTasks.map((t) => <TaskRow key={t.id} task={t} accent="done" showAssignee={false} />)
            )}
          </SectionList>
        </div>

        <div
          style={{
            background: "white",
            border: "0.5px solid #e1e0d9",
            borderRadius: "14px",
            padding: "1.1rem 1.2rem",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "12px" }}>
            BAS obligations
          </div>
          {basAssignments.length === 0 ? (
            <Empty />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {basAssignments.map((c) => (
                <div
                  key={c.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 12px",
                    background: "#fafaf8",
                    borderRadius: "8px",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{c.name}</div>
                    <div style={{ fontSize: "11px", color: "#888780", marginTop: "3px" }}>Due 28 Jun</div>
                  </div>
                  <BasStatusBadge status={c.basStatus} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionList({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "14px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>{children}</div>
    </div>
  );
}

function Empty() {
  return <div style={{ fontSize: "12px", color: "#888780", padding: "4px 0" }}>Nothing here.</div>;
}

function Legend({ rows }: { rows: { color: string; label: string; value: string }[] }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
      {rows.map((r) => (
        <div key={r.label} style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px" }}>
          <span
            style={{
              width: "10px",
              height: "10px",
              borderRadius: "2px",
              background: r.color,
              flexShrink: 0,
            }}
          />
          <span style={{ flex: 1, color: "#444441" }}>{r.label}</span>
          <span style={{ color: "#111111", fontWeight: 500 }}>{r.value}</span>
        </div>
      ))}
    </div>
  );
}
