"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import StaffSlicer from "@/components/layout/StaffSlicer";
import StatusFilter, { type StatusFilterValue } from "@/components/layout/StatusFilter";
import StatusPill from "@/components/dashboard/StatusPill";
import { initialsOf } from "@/lib/utils";
import { RECURRENCE_LABELS } from "@/lib/recurrence";
import type { WorkflowSnapshot } from "@/lib/workflow";
import type { StaffMember } from "@/types/dashboard";
import type { TaskRecurrence, WorkflowTaskView, WorkflowCustomer, WorkflowJob } from "@/types/workflow";
import { TASK_TYPE_SUGGESTIONS } from "@/types/workflow";

interface WorkflowPageClientProps {
  initial: WorkflowSnapshot;
}

type DuePreset = "all" | "overdue" | "today" | "week" | "month";

const DUE_PRESET_LABELS: Record<DuePreset, string> = {
  all: "Any due date",
  overdue: "Overdue",
  today: "Due today",
  week: "This week (+ overdue)",
  month: "This month",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00Z").getTime();
  const b = new Date(toIso + "T00:00:00Z").getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

function formatShort(iso: string): string {
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

const pillSelectStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "6px 10px",
  borderRadius: "999px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#444441",
  cursor: "pointer",
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

const NEW_OPTION = "__new__";

export default function WorkflowPageClient({ initial }: WorkflowPageClientProps) {
  const [data, setData] = useState(initial);
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>({ selected: [], mode: "exclude" });
  const [duePreset, setDuePreset] = useState<DuePreset>("all");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [syncing, setSyncing] = useState(false);
  const [banner, setBanner] = useState<string | null>(null);
  const [showAddWork, setShowAddWork] = useState(false);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);

  const today = todayIso();
  const weekEnd = addDays(today, 7);
  const monthEnd = addDays(today, 30);

  async function refreshAll() {
    const [tasksRes, customersRes, jobsRes] = await Promise.all([
      fetch("/api/workflow/tasks"),
      fetch("/api/workflow/customers"),
      fetch("/api/workflow/jobs"),
    ]);
    const [tasksBody, customersBody, jobsBody] = await Promise.all([
      tasksRes.json(),
      customersRes.json(),
      jobsRes.json(),
    ]);
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
      setBanner(`Recurring task rolled forward — next one due ${formatShort(body.nextTask.dueDate)}.`);
    }
  }

  async function handleTaskEdit(
    taskId: string,
    patch: { title: string; type: string; assigneeId: string | null; dueDate: string | null; recurrence: TaskRecurrence },
  ) {
    const res = await fetch(`/api/workflow/tasks/${taskId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    const body = await res.json();
    if (!res.ok) {
      setBanner(body.message ?? "Failed to update task.");
      return;
    }
    await refreshAll();
    setExpandedTaskId(null);
  }

  async function handleAddWork(input: {
    customerId: string;
    newCustomerName: string;
    jobId: string;
    newJobName: string;
    newJobManagerId: string;
    title: string;
    type: string;
    assigneeId: string | null;
    dueDate: string | null;
    recurrence: TaskRecurrence;
    statusId: string;
  }) {
    try {
      let customerId = input.customerId;
      if (customerId === NEW_OPTION) {
        const res = await fetch("/api/workflow/customers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: input.newCustomerName }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message ?? "Failed to create customer.");
        customerId = body.customer.id;
      }

      let jobId = input.jobId;
      if (jobId === NEW_OPTION) {
        const res = await fetch("/api/workflow/jobs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            customerId,
            name: input.newJobName,
            managerId: input.newJobManagerId || null,
          }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message ?? "Failed to create job.");
        jobId = body.job.id;
      }

      const res = await fetch("/api/workflow/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          title: input.title,
          type: input.type,
          assigneeId: input.assigneeId,
          dueDate: input.dueDate,
          recurrence: input.recurrence,
          statusId: input.statusId,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to create task.");

      await refreshAll();
      setShowAddWork(false);
    } catch (err) {
      setBanner(err instanceof Error ? err.message : "Failed to add work.");
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

  const distinctTypes = useMemo(
    () => Array.from(new Set(data.tasks.map((t) => t.type).filter(Boolean))).sort(),
    [data.tasks],
  );
  const statusOptions = useMemo(() => data.statuses.map((s) => s.name), [data.statuses]);

  function matchesDuePreset(task: WorkflowTaskView): boolean {
    if (duePreset === "all") return true;
    if (!task.dueDate) return false;
    if (duePreset === "overdue") return !task.status.isComplete && task.dueDate < today;
    if (duePreset === "today") return task.dueDate === today;
    if (duePreset === "week") {
      return (!task.status.isComplete && task.dueDate < today) || (task.dueDate >= today && task.dueDate <= weekEnd);
    }
    if (duePreset === "month") return task.dueDate >= today && task.dueDate <= monthEnd;
    return true;
  }

  const filteredTasks = data.tasks
    .filter((t) => !selectedStaffId || t.assigneeId === selectedStaffId || t.managerId === selectedStaffId)
    .filter((t) => {
      if (statusFilter.selected.length === 0) return true;
      const inSet = statusFilter.selected.includes(t.status.name);
      return statusFilter.mode === "include" ? inSet : !inSet;
    })
    .filter((t) => typeFilter === "all" || t.type === typeFilter)
    .filter(matchesDuePreset)
    .sort((a, b) => {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0;
    });

  const overdueCount = data.tasks.filter((t) => !t.status.isComplete && t.dueDate && t.dueDate < today).length;
  const dueWeekCount = data.tasks.filter(
    (t) => !t.status.isComplete && t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd,
  ).length;
  const completedCount = data.tasks.filter((t) => t.status.isComplete).length;

  return (
    <div>
      <PageHeader
        title="Workflow"
        subtitle="All tasks · in-house replacement for Karbon"
        action={
          <div style={{ display: "flex", gap: "8px" }}>
            <button type="button" onClick={handleSync} disabled={syncing} style={ghostButtonStyle}>
              {syncing ? "Syncing…" : "Sync from XPM"}
            </button>
            <button type="button" onClick={() => setShowAddWork((v) => !v)} style={buttonStyle}>
              + Add work
            </button>
          </div>
        }
      />

      {data.mode === "mock" ? (
        <Banner tone="warning">Showing mock data — {data.message ?? "Supabase is not configured."}</Banner>
      ) : null}
      {banner ? <Banner tone="info">{banner}</Banner> : null}

      {showAddWork ? (
        <AddWorkForm
          customers={data.customers}
          jobs={data.jobs}
          staff={data.staff.filter((s) => s.role !== "Partner")}
          statuses={data.statuses}
          onAdd={handleAddWork}
          onCancel={() => setShowAddWork(false)}
        />
      ) : null}

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
          padding: "12px 0",
        }}
      >
        <StatusFilter options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
        <select value={duePreset} onChange={(e) => setDuePreset(e.target.value as DuePreset)} style={pillSelectStyle}>
          {Object.entries(DUE_PRESET_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={pillSelectStyle}>
          <option value="all">All work types</option>
          {distinctTypes.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>
      </div>

      <StaffSlicer staff={staffOptions} selectedId={selectedStaffId} onChange={setSelectedStaffId} />

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "12px 18px",
          marginBottom: "14px",
        }}
      >
        <StatBlock label="Work items" value={String(filteredTasks.length)} />
        <Divider />
        <StatBlock label="Overdue" value={String(overdueCount)} color={overdueCount > 0 ? "#e24b4a" : undefined} />
        <Divider />
        <StatBlock label="Due this week" value={String(dueWeekCount)} />
        <Divider />
        <StatBlock label="Completed" value={String(completedCount)} />
      </div>

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
            gridTemplateColumns: "2.2fr 1.4fr 1fr 1.3fr 1fr 1fr 1.2fr",
            gap: "8px",
            padding: "10px 16px",
            borderBottom: "0.5px solid #e1e0d9",
            fontSize: "11px",
            fontWeight: 500,
            color: "#888780",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
          }}
        >
          <div>Task</div>
          <div>Client</div>
          <div>Type</div>
          <div>Status</div>
          <div>Due</div>
          <div>Repeat</div>
          <div>Assignee</div>
        </div>

        {filteredTasks.length === 0 ? (
          <div style={{ padding: "24px 16px", fontSize: "13px", color: "#888780" }}>No tasks match these filters.</div>
        ) : (
          filteredTasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              today={today}
              statuses={data.statuses}
              staff={data.staff.filter((s) => s.role !== "Partner")}
              expanded={expandedTaskId === task.id}
              onToggleExpand={() => setExpandedTaskId((id) => (id === task.id ? null : task.id))}
              onStatusChange={(statusId) => handleStatusChange(task.id, statusId)}
              onSaveEdit={(patch) => handleTaskEdit(task.id, patch)}
            />
          ))
        )}
      </div>
    </div>
  );
}

function StatBlock({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 500, color: color ?? "#111111", marginTop: "2px" }}>{value}</div>
    </div>
  );
}

function Divider() {
  return <div style={{ width: "0.5px", height: "32px", background: "#e1e0d9" }} />;
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

function dueMeta(task: WorkflowTaskView, today: string): { label: string; color: string } {
  if (!task.dueDate) return { label: "No due date", color: "#888780" };
  if (task.status.isComplete) return { label: formatShort(task.dueDate), color: "#888780" };
  const days = daysBetween(today, task.dueDate);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, color: "#e24b4a" };
  if (days === 0) return { label: "Due today", color: "#eda100" };
  return { label: formatShort(task.dueDate), color: "#444441" };
}

function TaskRow({
  task,
  today,
  statuses,
  staff,
  expanded,
  onToggleExpand,
  onStatusChange,
  onSaveEdit,
}: {
  task: WorkflowTaskView;
  today: string;
  statuses: WorkflowSnapshot["statuses"];
  staff: WorkflowSnapshot["staff"];
  expanded: boolean;
  onToggleExpand: () => void;
  onStatusChange: (statusId: string) => void;
  onSaveEdit: (patch: { title: string; type: string; assigneeId: string | null; dueDate: string | null; recurrence: TaskRecurrence }) => void;
}) {
  const due = dueMeta(task, today);
  return (
    <div style={{ borderBottom: "0.5px solid #f0efe9" }}>
      <div
        onClick={onToggleExpand}
        style={{
          display: "grid",
          gridTemplateColumns: "2.2fr 1.4fr 1fr 1.3fr 1fr 1fr 1.2fr",
          gap: "8px",
          alignItems: "center",
          padding: "12px 16px",
          cursor: "pointer",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{task.title}</div>
        <div style={{ fontSize: "13px", color: "#444441" }}>{task.customerName}</div>
        <div style={{ fontSize: "12px", color: "#888780" }}>{task.type}</div>
        <div onClick={(e) => e.stopPropagation()}>
          <StatusPill status={task.status} statuses={statuses} onChange={onStatusChange} />
        </div>
        <div style={{ fontSize: "12px", fontWeight: 500, color: due.color }}>{due.label}</div>
        <div style={{ fontSize: "12px", color: "#888780" }}>{RECURRENCE_LABELS[task.recurrence]}</div>
        <div style={{ fontSize: "12px", color: "#444441" }}>{task.assigneeName ?? "Unassigned"}</div>
      </div>
      {expanded ? (
        <div onClick={(e) => e.stopPropagation()} style={{ padding: "0 16px 16px" }}>
          <TaskDetail task={task} staff={staff} onSave={onSaveEdit} />
        </div>
      ) : null}
    </div>
  );
}

function TaskDetail({
  task,
  staff,
  onSave,
}: {
  task: WorkflowTaskView;
  staff: WorkflowSnapshot["staff"];
  onSave: (patch: { title: string; type: string; assigneeId: string | null; dueDate: string | null; recurrence: TaskRecurrence }) => void;
}) {
  const [title, setTitle] = useState(task.title);
  const [type, setType] = useState(task.type);
  const [assigneeId, setAssigneeId] = useState(task.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(task.dueDate ?? "");
  const [recurrence, setRecurrence] = useState<TaskRecurrence>(task.recurrence);

  return (
    <div
      style={{
        background: "#fafaf8",
        border: "0.5px solid #e1e0d9",
        borderRadius: "10px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ fontSize: "12px", color: "#888780" }}>
        {task.customerName} · {task.jobName} · Created {new Date(task.createdAt).toLocaleDateString("en-AU")}
        {task.recurrenceParentId ? " · Auto-generated from a recurring task" : ""}
      </div>
      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" style={{ ...inputStyle, flex: 2 }} />
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Type"
          list="task-type-suggestions"
          style={{ ...inputStyle, flex: 1 }}
        />
        <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inputStyle}>
          <option value="">Unassigned</option>
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
      </div>
      <div>
        <button
          type="button"
          style={buttonStyle}
          onClick={() =>
            onSave({
              title: title.trim(),
              type: type.trim() || "General",
              assigneeId: assigneeId || null,
              dueDate: dueDate || null,
              recurrence,
            })
          }
        >
          Save
        </button>
      </div>
    </div>
  );
}

function AddWorkForm({
  customers,
  jobs,
  staff,
  statuses,
  onAdd,
  onCancel,
}: {
  customers: WorkflowCustomer[];
  jobs: WorkflowJob[];
  staff: WorkflowSnapshot["staff"];
  statuses: WorkflowSnapshot["statuses"];
  onAdd: (input: {
    customerId: string;
    newCustomerName: string;
    jobId: string;
    newJobName: string;
    newJobManagerId: string;
    title: string;
    type: string;
    assigneeId: string | null;
    dueDate: string | null;
    recurrence: TaskRecurrence;
    statusId: string;
  }) => void;
  onCancel: () => void;
}) {
  const [customerId, setCustomerId] = useState("");
  const [newCustomerName, setNewCustomerName] = useState("");
  const [jobId, setJobId] = useState("");
  const [newJobName, setNewJobName] = useState("");
  const [newJobManagerId, setNewJobManagerId] = useState("");
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<TaskRecurrence>("none");
  const [statusId, setStatusId] = useState(statuses.find((s) => !s.isComplete)?.id ?? statuses[0]?.id ?? "");

  const isNewCustomer = customerId === NEW_OPTION;
  const jobsForCustomer = isNewCustomer ? [] : jobs.filter((j) => j.customerId === customerId);
  const isNewJob = isNewCustomer || jobId === NEW_OPTION;

  const canSave =
    (isNewCustomer ? newCustomerName.trim().length > 0 : customerId.length > 0) &&
    (isNewJob ? newJobName.trim().length > 0 : jobId.length > 0) &&
    title.trim().length > 0 &&
    statusId.length > 0;

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "16px",
        marginBottom: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>Add work</div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <select
          value={customerId}
          onChange={(e) => {
            setCustomerId(e.target.value);
            setJobId("");
          }}
          style={inputStyle}
        >
          <option value="">Customer…</option>
          {customers.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
          <option value={NEW_OPTION}>+ New customer</option>
        </select>
        {isNewCustomer ? (
          <input
            value={newCustomerName}
            onChange={(e) => setNewCustomerName(e.target.value)}
            placeholder="New customer name"
            style={inputStyle}
          />
        ) : null}

        <select value={jobId} onChange={(e) => setJobId(e.target.value)} style={inputStyle} disabled={!customerId}>
          <option value="">Job…</option>
          {jobsForCustomer.map((j) => (
            <option key={j.id} value={j.id}>
              {j.name}
            </option>
          ))}
          <option value={NEW_OPTION}>+ New job</option>
        </select>
        {isNewJob ? (
          <>
            <input
              value={newJobName}
              onChange={(e) => setNewJobName(e.target.value)}
              placeholder="New job name"
              style={inputStyle}
            />
            <select value={newJobManagerId} onChange={(e) => setNewJobManagerId(e.target.value)} style={inputStyle}>
              <option value="">Manager…</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Task title" style={{ ...inputStyle, flex: 2 }} />
        <input
          value={type}
          onChange={(e) => setType(e.target.value)}
          placeholder="Type (e.g. BAS/IAS)"
          list="task-type-suggestions"
          style={inputStyle}
        />
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
        <select value={statusId} onChange={(e) => setStatusId(e.target.value)} style={inputStyle}>
          {statuses.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>

      <datalist id="task-type-suggestions">
        {TASK_TYPE_SUGGESTIONS.map((s) => (
          <option key={s} value={s} />
        ))}
      </datalist>

      <div style={{ display: "flex", gap: "8px" }}>
        <button
          type="button"
          style={{ ...buttonStyle, opacity: canSave ? 1 : 0.5, cursor: canSave ? "pointer" : "default" }}
          disabled={!canSave}
          onClick={() =>
            onAdd({
              customerId,
              newCustomerName: newCustomerName.trim(),
              jobId,
              newJobName: newJobName.trim(),
              newJobManagerId,
              title: title.trim(),
              type: type.trim() || "General",
              assigneeId: assigneeId || null,
              dueDate: dueDate || null,
              recurrence,
              statusId,
            })
          }
        >
          Create
        </button>
        <button type="button" style={ghostButtonStyle} onClick={onCancel}>
          Cancel
        </button>
      </div>
    </div>
  );
}
