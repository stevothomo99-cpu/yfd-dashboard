"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import TaskRow from "@/components/dashboard/TaskRow";
import StaffSlicer from "@/components/layout/StaffSlicer";
import { staffFromAssignees } from "@/lib/utils";
import type { KarbonTask, KarbonUser } from "@/types/karbon";
import type { TasksSnapshot } from "./page";

interface TasksPageClientProps {
  initial: TasksSnapshot;
  staff: KarbonUser[];
  today: string;
  weekEnd: string;
}

export default function TasksPageClient({
  initial,
  staff: karbonUsers,
  today,
  weekEnd,
}: TasksPageClientProps) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/karbon/tasks", { method: "POST" });
      const body: TasksSnapshot = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to refresh tasks.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh tasks.");
    } finally {
      setRefreshing(false);
    }
  }

  const staff = staffFromAssignees(
    karbonUsers.map((u) => ({ assigneeId: u.id, assigneeName: u.name })),
  );
  const visible = data.tasks.filter((t) => !selectedId || t.assigneeId === selectedId);
  const weekAgo = addDays(today, -7);

  const overdue = visible.filter((t) => t.isOverdue);
  const dueToday = visible.filter((t) => !t.isOverdue && t.dueDate === today);
  const dueThisWeek = visible.filter(
    (t) => !t.isOverdue && t.dueDate > today && t.dueDate <= weekEnd && t.status !== "complete",
  );
  const completedRecently = visible.filter(
    (t) => t.status === "complete" && t.dueDate >= weekAgo,
  );

  return (
    <div>
      <PageHeader
        title="Karbon Tasks"
        subtitle="Active task load · refreshed every 5 minutes"
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: "999px",
              background: "white",
              color: "#444441",
              border: "0.5px solid #e1e0d9",
              cursor: refreshing ? "default" : "pointer",
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
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

      {error ? (
        <div
          style={{
            fontSize: "12px",
            color: "#501313",
            background: "#FCEBEB",
            border: "0.5px solid #f0b8b8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      ) : null}

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
        <KpiCard label="Due today" value={String(dueToday.length)} sub="Owed by EOD" />
        <KpiCard label="Due this week" value={String(dueThisWeek.length)} sub={`To ${formatShort(weekEnd)}`} />
        <KpiCard label="Completed" value={String(completedRecently.length)} sub="Last 7 days" />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "14px",
        }}
      >
        <TaskColumn title="Overdue" tone="overdue" tasks={overdue} />
        <TaskColumn title="Due today" tone="today" tasks={dueToday} />
        <TaskColumn title="Due this week" tone="week" tasks={dueThisWeek} />
      </div>
    </div>
  );
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function formatShort(iso: string): string {
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function TaskColumn({
  title,
  tone,
  tasks,
}: {
  title: string;
  tone: "overdue" | "today" | "week";
  tasks: KarbonTask[];
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
