"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { formatDate } from "@/lib/utils";
import type { BasStage, BasStageHistoryEntry, TaskWithDetails, WorkflowStaff } from "@/types/workflow";

interface BasStatusPageClientProps {
  initialTasks: TaskWithDetails[];
  staff: WorkflowStaff[];
  isAdmin: boolean;
  initialHistory: Record<string, BasStageHistoryEntry[]>;
}

type Stage = BasStage;

// Per-column identity (per Steve's ask): each tile gets its own accent
// colour -- a coloured top stripe plus a lightly tinted header -- so the
// three lists read as clearly distinct groups at a glance, without reading
// the header text. Deliberately kept to the header/stripe only, never the
// card body, so it never competes with the red/green overdue signal on
// individual cards (a per-card, not per-column, concern).
const TILES: { stage: Stage; label: string; hint: string; accent: string; tint: string }[] = [
  { stage: "pending", label: "Pending", hint: "Not yet submitted", accent: "#a8874f", tint: "rgba(168, 135, 79, 0.08)" },
  {
    stage: "ready_for_approval",
    label: "Ready for Approval",
    hint: "With Steve for review/lodgement",
    accent: "#3f6fb3",
    tint: "rgba(63, 111, 179, 0.08)",
  },
  {
    stage: "waiting_on_customer",
    label: "Waiting on Customer",
    hint: "Lodged -- back with the team",
    accent: "#7a5ea8",
    tint: "rgba(122, 94, 168, 0.08)",
  },
];

const STAGE_ORDER: Record<Stage, number> = { pending: 0, ready_for_approval: 1, waiting_on_customer: 2 };
const STAGE_LABEL: Record<Stage, string> = {
  pending: "Pending",
  ready_for_approval: "Ready for Approval",
  waiting_on_customer: "Waiting on Customer",
};

// Owner is the permanent assignee; Assigned To is whoever currently has it
// (the temp assignee during Ready for Approval, otherwise the owner) --
// same distinction My Work draws (see MyWorkPageClient.tsx).
function assignedToName(t: TaskWithDetails): string {
  return t.tempAssigneeName ?? t.assigneeName ?? "Unassigned";
}

function stageOf(t: TaskWithDetails): Stage {
  return t.basStage ?? "pending";
}

function formatChangedAt(iso: string): string {
  const d = new Date(iso);
  const time = d.toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return `${formatDate(iso)} ${time}`;
}

export default function BasStatusPageClient({ initialTasks, staff, initialHistory }: BasStatusPageClientProps) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [historyByTaskId, setHistoryByTaskId] = useState<Record<string, BasStageHistoryEntry[]>>(initialHistory);
  const [expandedTaskId, setExpandedTaskId] = useState<string | null>(null);
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

  async function transition(taskId: string, stage: Stage) {
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
      if (data.historyEntry) {
        setHistoryByTaskId((prev) => ({
          ...prev,
          [taskId]: [...(prev[taskId] ?? []), data.historyEntry as BasStageHistoryEntry],
        }));
      }
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
          <div
            key={tile.stage}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              background: tile.tint,
              borderTop: `3px solid ${tile.accent}`,
              borderRadius: "10px",
              padding: "10px 10px 12px",
            }}
          >
            <div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: tile.accent }}>
                {tile.label}
                <span style={{ marginLeft: "6px", fontSize: "11px", fontWeight: 500, color: "#888780" }}>
                  ({columns[tile.stage].length})
                </span>
              </div>
              <div style={{ fontSize: "10px", color: "#888780", marginTop: "1px" }}>{tile.hint}</div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {columns[tile.stage].length === 0 ? (
                <EmptyTile />
              ) : (
                columns[tile.stage].map((t) => (
                  <TaskCard
                    key={t.id}
                    task={t}
                    busy={pendingTaskId === t.id}
                    history={historyByTaskId[t.id] ?? []}
                    expanded={expandedTaskId === t.id}
                    onToggleHistory={() => setExpandedTaskId((prev) => (prev === t.id ? null : t.id))}
                    onBack={() => transition(t.id, (Object.keys(STAGE_ORDER) as Stage[]).find((s) => STAGE_ORDER[s] === STAGE_ORDER[stageOf(t)] - 1)!)}
                    onForward={() => transition(t.id, (Object.keys(STAGE_ORDER) as Stage[]).find((s) => STAGE_ORDER[s] === STAGE_ORDER[stageOf(t)] + 1)!)}
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
  history,
  expanded,
  onToggleHistory,
  onBack,
  onForward,
}: {
  task: TaskWithDetails;
  busy: boolean;
  history: BasStageHistoryEntry[];
  expanded: boolean;
  onToggleHistory: () => void;
  onBack: () => void;
  onForward: () => void;
}) {
  const stage = stageOf(task);
  const canGoBack = STAGE_ORDER[stage] > 0;
  const canGoForward = STAGE_ORDER[stage] < 2;
  // Same "overdue" rule the rest of the dashboard uses -- isOverdue is
  // computed server-side in lib/workflow.ts's hydrateTask (due_date < today
  // && not complete), the same convention getClientSummaries and My Work's
  // startBucketOf/toneOf are built on. Red for overdue, a neutral/green tone
  // otherwise -- a per-card signal, distinct from the column's own accent.
  const dueColor = task.isOverdue ? "#c0392b" : "#3a7d44";

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "10px",
        padding: "8px 10px",
        opacity: busy ? 0.6 : 1,
        fontSize: "12px",
        lineHeight: 1.3,
      }}
    >
      <div style={{ fontSize: "12px", fontWeight: 600, color: "#111111" }}>{task.customerName}</div>
      <div style={{ fontSize: "11px", color: "#444441", marginTop: "1px" }}>{task.title}</div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: "4px", fontSize: "10.5px" }}>
        <span style={{ color: dueColor, fontWeight: 600 }}>Due {formatDate(task.dueDate)}</span>
        <span style={{ color: "#888780" }}>{assignedToName(task)}</span>
      </div>

      <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
        {canGoBack ? (
          <button type="button" disabled={busy} onClick={onBack} style={stageButtonStyle}>
            ‹ Back
          </button>
        ) : null}
        {canGoForward ? (
          <button type="button" disabled={busy} onClick={onForward} style={stageButtonStyle}>
            Forward ›
          </button>
        ) : null}
      </div>

      <button type="button" onClick={onToggleHistory} style={historyToggleStyle}>
        {expanded ? "▾" : "▸"} History ({history.length})
      </button>

      {expanded ? (
        <div style={{ marginTop: "4px", borderTop: "0.5px solid #eeede7", paddingTop: "4px" }}>
          {history.length === 0 ? (
            <div style={{ fontSize: "10px", color: "#c7c5bc" }}>No transitions recorded yet.</div>
          ) : (
            history
              .slice()
              .reverse()
              .map((h) => (
                <div key={h.id} style={{ fontSize: "10px", color: "#888780", padding: "1px 0" }}>
                  {h.fromStage ? STAGE_LABEL[h.fromStage] : "—"} → {STAGE_LABEL[h.toStage]}
                  {" · "}
                  {formatChangedAt(h.changedAt)}
                  {h.changedByName ? ` · ${h.changedByName}` : ""}
                </div>
              ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function EmptyTile() {
  return (
    <div
      style={{
        border: "0.5px dashed #d9d7cd",
        borderRadius: "10px",
        padding: "14px 10px",
        textAlign: "center",
        fontSize: "11px",
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

const stageButtonStyle: React.CSSProperties = {
  fontSize: "10.5px",
  fontWeight: 600,
  padding: "3px 8px",
  borderRadius: "6px",
  border: "0.5px solid #d9d7cd",
  background: "#faf9f6",
  color: "#444441",
  cursor: "pointer",
};

const historyToggleStyle: React.CSSProperties = {
  display: "block",
  marginTop: "5px",
  fontSize: "10px",
  fontWeight: 500,
  color: "#888780",
  background: "none",
  border: "none",
  padding: 0,
  cursor: "pointer",
};
