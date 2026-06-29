"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import TaskRow from "@/components/dashboard/TaskRow";
import StaffSlicer from "@/components/layout/StaffSlicer";
import { includedStaff, TASKS } from "@/lib/mock";

const TODAY = "2026-06-29";
const WEEK_END = "2026-07-05";

export default function TasksPage() {
  const staff = includedStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const includedIds = new Set(staff.map((s) => s.id));
  const visible = TASKS.filter(
    (t) => includedIds.has(t.assigneeId) && (!selectedId || t.assigneeId === selectedId),
  );

  const overdue = visible.filter((t) => t.isOverdue);
  const today = visible.filter((t) => !t.isOverdue && t.dueDate === TODAY);
  const week = visible.filter(
    (t) => !t.isOverdue && t.dueDate > TODAY && t.dueDate <= WEEK_END && t.status !== "complete",
  );
  const done = visible.filter((t) => t.status === "complete");

  return (
    <div>
      <PageHeader title="Karbon Tasks" subtitle="Active task load · refreshed every 5 minutes" />

      <StaffSlicer staff={staff} selectedId={selectedId} onChange={setSelectedId} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <KpiCard
          label="Overdue"
          value={String(overdue.length)}
          valueColor={overdue.length > 0 ? "#e24b4a" : "#111111"}
          sub="Past due date"
        />
        <KpiCard label="Due today" value={String(today.length)} sub="Owed by EOD" />
        <KpiCard label="Due this week" value={String(week.length)} sub="To 5 Jul" />
        <KpiCard label="Completed" value={String(done.length)} sub="Last 7 days" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "14px",
        }}
      >
        <TaskColumn title="Overdue" tone="overdue" tasks={overdue} />
        <TaskColumn title="Due today" tone="today" tasks={today} />
        <TaskColumn title="Due this week" tone="week" tasks={week} />
      </div>
    </div>
  );
}

function TaskColumn({
  title,
  tone,
  tasks,
}: {
  title: string;
  tone: "overdue" | "today" | "week";
  tasks: ReturnType<typeof TASKS.filter>;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "baseline",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{title}</div>
        <div style={{ fontSize: "11px", color: "#888780" }}>{tasks.length}</div>
      </div>
      {tasks.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>Nothing here.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} accent={tone} />
          ))}
        </div>
      )}
    </div>
  );
}
