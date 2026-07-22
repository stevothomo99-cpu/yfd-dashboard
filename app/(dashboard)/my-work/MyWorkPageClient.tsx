"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import type { TaskWithDetails, WorkflowStaff } from "@/types/workflow";

interface MyWorkPageClientProps {
  allStaff: WorkflowStaff[];
  defaultStaffId: string | null;
  isSessionMatch: boolean;
  initialTasks: TaskWithDetails[];
}

const RECURRENCE_LABEL: Record<TaskWithDetails["recurrence"], string> = {
  none: "One-off",
  daily: "Repeats daily",
  weekly: "Repeats weekly",
  fortnightly: "Repeats fortnightly",
  monthly: "Repeats monthly",
  quarterly: "Repeats quarterly",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function MyWorkPageClient({
  allStaff,
  defaultStaffId,
  isSessionMatch,
  initialTasks,
}: MyWorkPageClientProps) {
  const [staffId, setStaffId] = useState<string | null>(defaultStaffId);
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [loading, setLoading] = useState(false);

  async function handleStaffChange(nextStaffId: string) {
    setStaffId(nextStaffId);
    setLoading(true);
    try {
      const res = await fetch(`/api/workflow/my-work?staffId=${nextStaffId}`);
      const data = await res.json();
      setTasks(data.tasks ?? []);
    } finally {
      setLoading(false);
    }
  }

  const today = todayIso();

  const groups = useMemo(() => {
    const active = tasks.filter((t) => !t.statusIsComplete);
    const completed = tasks.filter((t) => t.statusIsComplete);
    return {
      overdue: active.filter((t) => t.dueDate && t.dueDate < today).sort(byDueDate),
      dueToday: active.filter((t) => t.dueDate === today),
      upcoming: active.filter((t) => t.dueDate && t.dueDate > today).sort(byDueDate),
      noDueDate: active.filter((t) => !t.dueDate),
      completed: completed.sort((a, b) => (b.completedAt ?? "").localeCompare(a.completedAt ?? "")),
    };
  }, [tasks, today]);

  const selectedStaff = allStaff.find((s) => s.id === staffId);

  if (!staffId) {
    return (
      <div>
        <PageHeader title="My Work" subtitle="Overdue, due-today, and upcoming work items" />
        <EmptyState message="No staff records yet -- add a row to the staff table to trial this view." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Work"
        subtitle="Prototype -- per-user work item board, replacing Karbon's task list"
      />

      <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "12px 0 18px", flexWrap: "wrap" }}>
        <select value={staffId} onChange={(e) => handleStaffChange(e.target.value)} style={selectStyle}>
          {allStaff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.role})
            </option>
          ))}
        </select>
        {!isSessionMatch ? (
          <span style={{ fontSize: "11px", color: "#888780" }}>
            Prototype: no staff row matches your login yet, so &quot;{selectedStaff?.name}&quot; is shown by
            default -- use the dropdown to view any staff member&apos;s board.
          </span>
        ) : null}
      </div>

      {loading ? (
        <EmptyState message="Loading…" />
      ) : tasks.length === 0 ? (
        <EmptyState message="Nothing on this board." />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <TaskGroup title="Overdue" tasks={groups.overdue} staffId={staffId} accent="#e24b4a" />
          <TaskGroup title="Due today" tasks={groups.dueToday} staffId={staffId} accent="#eda100" />
          <TaskGroup title="Upcoming" tasks={groups.upcoming} staffId={staffId} accent="#2a78d6" />
          <TaskGroup title="No due date" tasks={groups.noDueDate} staffId={staffId} accent="#888780" />
          <TaskGroup title="Completed" tasks={groups.completed} staffId={staffId} accent="#1baf7a" collapsedByDefault />
        </div>
      )}
    </div>
  );
}

function byDueDate(a: TaskWithDetails, b: TaskWithDetails): number {
  return (a.dueDate ?? "").localeCompare(b.dueDate ?? "");
}

function TaskGroup({
  title,
  tasks,
  staffId,
  accent,
  collapsedByDefault,
}: {
  title: string;
  tasks: TaskWithDetails[];
  staffId: string;
  accent: string;
  collapsedByDefault?: boolean;
}) {
  const [open, setOpen] = useState(!collapsedByDefault);

  if (tasks.length === 0) return null;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "0 0 8px",
        }}
      >
        <span style={{ width: "8px", height: "8px", borderRadius: "999px", background: accent }} />
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>
          {title} ({tasks.length})
        </span>
        <span style={{ fontSize: "11px", color: "#888780" }}>{open ? "▾" : "▸"}</span>
      </button>

      {open ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {tasks.map((t) => (
            <TaskCard key={t.id} task={t} staffId={staffId} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function TaskCard({ task, staffId }: { task: TaskWithDetails; staffId: string }) {
  const isOwner = task.assigneeId === staffId;
  const reassignmentNote = task.isTemporarilyReassigned
    ? isOwner
      ? `Currently with ${task.tempAssigneeName ?? "someone else"} (temporary)`
      : `Temporarily assigned to you -- owned by ${task.assigneeName ?? "someone else"}`
    : null;

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "10px",
        padding: "12px 16px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{task.title}</div>
        <div style={{ fontSize: "12px", color: "#888780" }}>
          {task.customerName} · {task.jobName}
        </div>
        {reassignmentNote ? (
          <div style={{ fontSize: "11px", color: "#9b59b6", fontWeight: 500 }}>{reassignmentNote}</div>
        ) : null}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
        {task.typeName ? <Chip label={task.typeName} color={task.typeColor ?? "#888780"} /> : null}
        <Chip label={task.statusName} color={task.statusColor} />
        {task.recurrence !== "none" ? (
          <span style={{ fontSize: "11px", color: "#888780" }}>{RECURRENCE_LABEL[task.recurrence]}</span>
        ) : null}
        <span style={{ fontSize: "12px", color: "#444441", minWidth: "76px", textAlign: "right" }}>
          {task.dueDate ?? "No due date"}
        </span>
      </div>
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 500,
        padding: "3px 8px",
        borderRadius: "999px",
        background: `${color}1a`,
        color,
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "48px 24px",
        textAlign: "center",
        color: "#888780",
        fontSize: "13px",
      }}
    >
      {message}
    </div>
  );
}

const selectStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "7px 12px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
};
