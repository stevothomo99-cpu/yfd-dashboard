"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { formatDate } from "@/lib/utils";
import type { TaskWithDetails, WorkflowStaff } from "@/types/workflow";

interface BasStatusPageClientProps {
  initialTasks: TaskWithDetails[];
  staff: WorkflowStaff[];
  isAdmin: boolean;
}

type Stage = "pending" | "ready_for_approval" | "waiting_on_customer";

const TILES: { stage: Stage; label: string; hint: string }[] = [
  { stage: "pending", label: "Pending", hint: "Not yet submitted" },
  { stage: "ready_for_approval", label: "Ready for Approval", hint: "With Steve for review/lodgement" },
  { stage: "waiting_on_customer", label: "Waiting on Customer", hint: "Lodged -- back with the team" },
];

// Owner is the permanent assignee; Assigned To is whoever currently has it
// (the temp assignee during Ready for Approval, otherwise the owner) --
// same distinction My Work draws (see MyWorkPageClient.tsx).
function assignedToName(t: TaskWithDetails): string {
  return t.tempAssigneeName ?? t.assigneeName ?? "Unassigned";
}

function stageOf(t: TaskWithDetails): Stage {
  return t.basStage ?? "pending";
}

export default function BasStatusPageClient({ initialTasks, staff }: BasStatusPageClientProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [employeeFilter, setEmployeeFilter] = useState<string>("");
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // The employee filter is keyed on "Assigned to" (the practical, currently-
  // holding-it person) rather than Owner -- a Ready for Approval task is
  // temporarily with Steve, but the employee filter is for a staff member to
  // find their own queue, so it matches whichever name My Work would show
  // in that column.
  const employeeOptions = useMemo(
    () => Array.from(new Set([...staff.map((s) => s.name), ...tasks.map(assignedToName)])).sort(),
    [staff, tasks]
  );

  const filtered = useMemo(() => {
    if (!employeeFilter) return tasks;
    return tasks.filter((t) => assignedToName(t) === employeeFilter || t.assigneeName === employeeFilter);
  }, [tasks, employeeFilter]);

  const columns = useMemo(() => {
    const byStage: Record<Stage, TaskWithDetails[]> = {
      pending: [],
      ready_for_approval: [],
      waiting_on_customer: [],
    };
    for (const t of filtered) byStage[stageOf(t)].push(t);
    for (const stage of Object.keys(byStage) as Stage[]) {
      byStage[stage].sort((a, b) => (a.dueDate ?? "9999-99-99").localeCompare(b.dueDate ?? "9999-99-99"));
    }
    return byStage;
  }, [filtered]);

  async function transition(taskId: string, stage: "ready_for_approval" | "waiting_on_customer") {
    setPendingTaskId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/tasks/${taskId}/bas-stage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stage }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to update task");
        return;
      }
      setTasks((prev) => prev.map((t) => (t.id === taskId ? (data.task as TaskWithDetails) : t)));
    } catch {
      setError("Failed to update task");
    } finally {
      setPendingTaskId(null);
    }
  }

  return (
    <div>
      <PageHeader
        title="BAS Status"
        subtitle="BAS/IAS tasks moving through the approval pipeline -- Pending → Ready for Approval → Waiting on Customer"
      />

      <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 0", flexWrap: "wrap" }}>
        <select value={employeeFilter} onChange={(e) => setEmployeeFilter(e.target.value)} style={selectStyle}>
          <option value="">All employees</option>
          {employeeOptions.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: "12px", color: "#888780" }}>{filtered.length} BAS/IAS task{filtered.length === 1 ? "" : "s"}</span>
      </div>

      {error ? (
        <div
          style={{
            background: "rgba(226, 75, 74, 0.08)",
            border: "0.5px solid rgba(226, 75, 74, 0.3)",
            color: "#c0392b",
            fontSize: "12px",
            padding: "8px 12px",
            borderRadius: "8px",
            marginBottom: "10px",
          }}
        >
          {error}
        </div>
      ) : null}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(260px, 1fr))",
          gap: "16px",
          alignItems: "start",
        }}
      >
        {TILES.map((tile) => (
          <div key={tile.stage} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            <div>
              <div style={{ fontSize: "14px", fontWeight: 600, color: "#111111" }}>
                {tile.label}
                <span style={{ marginLeft: "6px", fontSize: "12px", fontWeight: 500, color: "#888780" }}>
                  ({columns[tile.stage].length})
                </span>
              </div>
              <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>{tile.hint}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {columns[tile.stage].length === 0 ? (
                <EmptyTile />
              ) : (
                columns[tile.stage].map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    busy={pendingTaskId === t.id}
                    onReadyForApproval={() => transition(t.id, "ready_for_approval")}
                    onSentToClient={() => transition(t.id, "waiting_on_customer")}
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TaskCard({
  task,
  busy,
  onReadyForApproval,
  onSentToClient,
}: {
  task: TaskWithDetails;
  busy: boolean;
  onReadyForApproval: () => void;
  onSentToClient: () => void;
}) {
  const stage = stageOf(task);
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "12px",
        padding: "12px 14px",
        opacity: busy ? 0.6 : 1,
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{task.customerName}</div>
      <div style={{ fontSize: "12px", color: "#444441", marginTop: "2px" }}>{task.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", color: "#888780" }}>
        <span>Due {formatDate(task.dueDate)}</span>
        <span>{assignedToName(task)}</span>
      </div>

      {stage === "pending" ? (
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={false} disabled={busy} onChange={onReadyForApproval} />
          Ready for Approval
        </label>
      ) : null}

      {stage === "ready_for_approval" ? (
        <label style={checkboxLabelStyle}>
          <input type="checkbox" checked={false} disabled={busy} onChange={onSentToClient} />
          Sent to Client
        </label>
      ) : null}
    </div>
  );
}

function EmptyTile() {
  return (
    <div
      style={{
        border: "0.5px dashed #e1e0d9",
        borderRadius: "12px",
        padding: "20px 14px",
        textAlign: "center",
        fontSize: "12px",
        color: "#c7c5bc",
      }}
    >
      Nothing here
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

const checkboxLabelStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "6px",
  marginTop: "10px",
  fontSize: "12px",
  color: "#444441",
  cursor: "pointer",
};
