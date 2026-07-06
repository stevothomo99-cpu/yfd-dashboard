"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import StaffSlicer from "@/components/layout/StaffSlicer";
import StatusPill from "@/components/dashboard/StatusPill";
import { initialsOf } from "@/lib/utils";
import { RECURRENCE_LABELS } from "@/lib/recurrence";
import type { WorkflowSnapshot } from "@/lib/workflow";
import type { StaffMember } from "@/types/dashboard";
import type { TaskRecurrence, WorkflowTaskView } from "@/types/workflow";

interface WorkflowPageClientProps {
  initial: WorkflowSnapshot;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDue(iso: string | null): string {
  if (!iso) return "No due date";
  return new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  padding: "7px 10px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
};

const buttonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "6px 12px",
  borderRadius: "999px",
  background: "#111111",
  color: "white",
  border: "none",
  cursor: "pointer",
};

const ghostButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
};

export default function WorkflowPageClient({ initial }: WorkflowPageClientProps) {
  const [data, setData] = useState(initial);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [showAddCustomer, setShowAddCustomer] = useState(false);
  const [showAddJob, setShowAddJob] = useState<string | null>(null); // customerId
  const [showAddTask, setShowAddTask] = useState<string | null>(null); // jobId

  const today = todayIso();

  async function refreshAll() {
    const [tasksRes, customersRes, jobsRes, staffRes] = await Promise.all([
      fetch("/api/workflow/tasks"),
      fetch("/api/workflow/customers"),
      fetch("/api/workflow/jobs"),
      fetch("/api/workflow/statuses"),
    ]);
    const [tasksBody, customersBody, jobsBody] = await Promise.all([
      tasksRes.json(),
      customersRes.json(),
      jobsRes.json(),
    ]);
    void staffRes;
    setData((prev) => ({
      ...prev,
      tasks: tasksBody.tasks ?? prev.tasks,
      customers: customersBody.customers ?? prev.customers,
      jobs: jobsBody.jobs ?? prev.jobs,
    }));
  }

  async function handleSync() {
    setSyncing(true);
    setBanner(null);
    try {
      const res = await fetch("/api/workflow/sync-xpm", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Sync failed.");
      setBanner(`Synced ${body.staffSynced} staff and ${body.customersSynced} customers from XPM.`);
      await refreshAll();
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleAddCustomer(name: string) {
    const res = await fetch("/api/workflow/customers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBanner(body.message ?? "Failed to add customer.");
      return;
    }
    setData((prev) => ({ ...prev, customers: [...prev.customers, body.customer] }));
    setShowAddCustomer(false);
  }

  async function handleAddJob(customerId: string, name: string, managerId: string | null) {
    const res = await fetch("/api/workflow/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ customerId, name, managerId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBanner(body.message ?? "Failed to add job.");
      return;
    }
    setData((prev) => ({ ...prev, jobs: [...prev.jobs, body.job] }));
    setShowAddJob(null);
  }

  async function handleAddTask(
    jobId: string,
    title: string,
    assigneeId: string | null,
    dueDate: string | null,
    recurrence: TaskRecurrence,
  ) {
    const defaultStatus = data.statuses.find((s) => !s.isComplete) ?? data.statuses[0];
    const res = await fetch("/api/workflow/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, title, assigneeId, dueDate, recurrence, statusId: defaultStatus?.id }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBanner(body.message ?? "Failed to add task.");
      return;
    }
    await refreshAll();
    setShowAddTask(null);
  }

  async function handleStatusChange(taskId: string, statusId: string) {
    const res = await fetch(`/api/workflow/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statusId }),
    });
    const body = await res.json();
    if (!res.ok) {
      setBanner(body.message ?? "Failed to update task.");
      return;
    }
    await refreshAll();
    if (body.nextTask) {
      setBanner(`Recurring task rolled forward — next one due ${formatDue(body.nextTask.dueDate)}.`);
    }
  }

  const staffOptions: StaffMember[] = useMemo(
    () =>
      data.staff
        .filter((s) => s.included)
        .map((s) => ({
          id: s.id,
          name: s.name,
          initials: initialsOf(s.name),
          xpmRole: s.role,
          score: 0,
          billableHours: 0,
          nonBillableHours: 0,
          billablePct: 0,
          tasksDone: 0,
          tasksOverdue: 0,
          basOverdue: 0,
          dailyHours: [],
          included: true,
        })),
    [data.staff],
  );

  const visibleTasks = data.tasks.filter(
    (t) => !selectedStaffId || t.assigneeId === selectedStaffId || t.managerId === selectedStaffId,
  );
  const overdueCount = visibleTasks.filter((t) => !t.status.isComplete && t.dueDate && t.dueDate < today).length;
  const dueTodayCount = visibleTasks.filter((t) => !t.status.isComplete && t.dueDate === today).length;
  const openCount = visibleTasks.filter((t) => !t.status.isComplete).length;
  const completedCount = visibleTasks.filter((t) => t.status.isComplete).length;

  const customersWithTasks = data.customers
    .map((customer) => {
      const jobs = data.jobs
        .filter((j) => j.customerId === customer.id)
        .map((job) => ({
          job,
          tasks: visibleTasks.filter((t) => t.jobId === job.id),
        }));
      const allTasks = jobs.flatMap((j) => j.tasks);
      const hasOverdue = allTasks.some((t) => !t.status.isComplete && t.dueDate && t.dueDate < today);
      const hasOpen = allTasks.some((t) => !t.status.isComplete);
      return { customer, jobs, hasOverdue, hasOpen };
    })
    .sort((a, b) => {
      if (a.hasOverdue !== b.hasOverdue) return a.hasOverdue ? -1 : 1;
      if (a.hasOpen !== b.hasOpen) return a.hasOpen ? -1 : 1;
      return a.customer.name.localeCompare(b.customer.name);
    });

  return (
    <div>
      <PageHeader
        title="Workflow"
        subtitle="Customer → Job → Task · in-house replacement for Karbon"
        action={
          <button type="button" onClick={handleSync} disabled={syncing} style={ghostButtonStyle}>
            {syncing ? "Syncing…" : "Sync staff & customers from XPM"}
          </button>
        }
      />

      {data.mode === "mock" ? (
        <Banner tone="warning">Showing mock data — {data.message ?? "Supabase is not configured."}</Banner>
      ) : null}
      {banner ? <Banner tone="info">{banner}</Banner> : null}

      <StaffSlicer staff={staffOptions} selectedId={selectedStaffId} onChange={setSelectedStaffId} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <KpiCard label="Overdue" value={String(overdueCount)} valueColor={overdueCount > 0 ? "#e24b4a" : "#111111"} sub="Past due date" />
        <KpiCard label="Due today" value={String(dueTodayCount)} sub="Owed by EOD" />
        <KpiCard label="Open" value={String(openCount)} sub="Across all customers" />
        <KpiCard label="Completed" value={String(completedCount)} sub="All time" />
      </div>

      <div style={{ marginBottom: "14px" }}>
        {showAddCustomer ? (
          <AddCustomerForm onAdd={handleAddCustomer} onCancel={() => setShowAddCustomer(false)} />
        ) : (
          <button type="button" onClick={() => setShowAddCustomer(true)} style={ghostButtonStyle}>
            + Add customer
          </button>
        )}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
        {customersWithTasks.map(({ customer, jobs, hasOverdue }) => (
          <div
            key={customer.id}
            style={{
              background: "white",
              border: "0.5px solid #e1e0d9",
              borderTop: `3px solid ${hasOverdue ? "#e24b4a" : "#e1e0d9"}`,
              borderRadius: "14px",
              padding: "1.1rem 1.2rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "10px" }}>
              <div style={{ fontSize: "15px", fontWeight: 500, color: "#111111" }}>{customer.name}</div>
              <button type="button" onClick={() => setShowAddJob(customer.id)} style={{ ...ghostButtonStyle, fontSize: "11px", padding: "4px 10px" }}>
                + Add job
              </button>
            </div>

            {showAddJob === customer.id ? (
              <div style={{ marginBottom: "10px" }}>
                <AddJobForm
                  staff={data.staff.filter((s) => s.role !== "Partner")}
                  onAdd={(name, managerId) => handleAddJob(customer.id, name, managerId)}
                  onCancel={() => setShowAddJob(null)}
                />
              </div>
            ) : null}

            {jobs.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#888780" }}>No jobs yet.</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {jobs.map(({ job, tasks }) => (
                  <div key={job.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "6px" }}>
                      <div style={{ fontSize: "13px", fontWeight: 500, color: "#444441" }}>{job.name}</div>
                      <button
                        type="button"
                        onClick={() => setShowAddTask(job.id)}
                        style={{ ...ghostButtonStyle, fontSize: "11px", padding: "3px 9px" }}
                      >
                        + Add task
                      </button>
                    </div>

                    {showAddTask === job.id ? (
                      <div style={{ marginBottom: "8px" }}>
                        <AddTaskForm
                          staff={data.staff.filter((s) => s.role !== "Partner")}
                          onAdd={(title, assigneeId, dueDate, recurrence) =>
                            handleAddTask(job.id, title, assigneeId, dueDate, recurrence)
                          }
                          onCancel={() => setShowAddTask(null)}
                        />
                      </div>
                    ) : null}

                    {tasks.length === 0 ? (
                      <div style={{ fontSize: "12px", color: "#888780" }}>No tasks.</div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {tasks.map((task) => (
                          <TaskLine
                            key={task.id}
                            task={task}
                            today={today}
                            statuses={data.statuses}
                            onStatusChange={(statusId) => handleStatusChange(task.id, statusId)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "warning" | "info"; children: React.ReactNode }) {
  const palette =
    tone === "warning"
      ? { color: "#633806", background: "#FAEEDA", border: "#f0d9a8" }
      : { color: "#1a3a6b", background: "#E6F1FB", border: "#b8d4f0" };
  return (
    <div
      style={{
        fontSize: "12px",
        color: palette.color,
        background: palette.background,
        border: `0.5px solid ${palette.border}`,
        borderRadius: "10px",
        padding: "8px 12px",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}

function TaskLine({
  task,
  today,
  statuses,
  onStatusChange,
}: {
  task: WorkflowTaskView;
  today: string;
  statuses: WorkflowSnapshot["statuses"];
  onStatusChange: (statusId: string) => void;
}) {
  const isOverdue = !task.status.isComplete && Boolean(task.dueDate) && (task.dueDate as string) < today;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "10px 12px",
        background: "#fafaf8",
        borderRadius: "8px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{task.title}</div>
        <div style={{ fontSize: "12px", color: isOverdue ? "#e24b4a" : "#888780", marginTop: "3px" }}>
          {task.assigneeName ?? "Unassigned"} · Due {formatDue(task.dueDate)}
          {task.recurrence !== "none" ? ` · ${RECURRENCE_LABELS[task.recurrence]}` : ""}
        </div>
      </div>
      <StatusPill status={task.status} statuses={statuses} onChange={onStatusChange} />
    </div>
  );
}

function AddCustomerForm({ onAdd, onCancel }: { onAdd: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  return (
    <div style={{ display: "flex", gap: "8px" }}>
      <input
        placeholder="Customer name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={inputStyle}
      />
      <button type="button" style={buttonStyle} onClick={() => name.trim() && onAdd(name.trim())}>
        Save
      </button>
      <button type="button" style={ghostButtonStyle} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function AddJobForm({
  staff,
  onAdd,
  onCancel,
}: {
  staff: WorkflowSnapshot["staff"];
  onAdd: (name: string, managerId: string | null) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [managerId, setManagerId] = useState("");
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <input placeholder="Job name" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <select value={managerId} onChange={(e) => setManagerId(e.target.value)} style={inputStyle}>
        <option value="">Manager…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <button type="button" style={buttonStyle} onClick={() => name.trim() && onAdd(name.trim(), managerId || null)}>
        Save
      </button>
      <button type="button" style={ghostButtonStyle} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}

function AddTaskForm({
  staff,
  onAdd,
  onCancel,
}: {
  staff: WorkflowSnapshot["staff"];
  onAdd: (title: string, assigneeId: string | null, dueDate: string | null, recurrence: TaskRecurrence) => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence>("none");
  return (
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
      <input placeholder="Task title" value={title} onChange={(e) => setTitle(e.target.value)} style={inputStyle} />
      <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inputStyle}>
        <option value="">Assignee…</option>
        {staff.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
      <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
      <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as TaskRecurrence)} style={inputStyle}>
        {Object.entries(RECURRENCE_LABELS).map(([value, label]) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
      <button
        type="button"
        style={buttonStyle}
        onClick={() => title.trim() && onAdd(title.trim(), assigneeId || null, dueDate || null, recurrence)}
      >
        Save
      </button>
      <button type="button" style={ghostButtonStyle} onClick={onCancel}>
        Cancel
      </button>
    </div>
  );
}
