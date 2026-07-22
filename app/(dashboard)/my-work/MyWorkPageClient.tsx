"use client";

import { useCallback, useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusFilter, { applyStatusFilter, type StatusFilterValue } from "@/components/layout/StatusFilter";
import NewTaskModal from "@/components/dashboard/NewTaskModal";
import type {
  JobWithCustomer,
  TaskWithDetails,
  WorkflowStaff,
  WorkflowStatus,
  WorkflowTaskType,
} from "@/types/workflow";

interface MyWorkPageClientProps {
  allStaff: WorkflowStaff[];
  isAdmin: boolean;
  hasSessionMatch: boolean;
  defaultStaffId: string | null;
  defaultStaffName: string | null;
  initialTasks: TaskWithDetails[];
  jobs: JobWithCustomer[];
  staffOptions: WorkflowStaff[];
  statuses: WorkflowStatus[];
  taskTypes: WorkflowTaskType[];
}

const RECURRENCE_LABEL: Record<TaskWithDetails["recurrence"], string> = {
  none: "One-off",
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

type MasterView = "all" | "overdue" | "week" | "completed";

const MASTER_VIEWS: { value: MasterView; label: string }[] = [
  { value: "all", label: "All Work" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due this week" },
  { value: "completed", label: "Completed" },
];

type SortField =
  | "title"
  | "customerName"
  | "jobName"
  | "typeName"
  | "statusName"
  | "ownerName"
  | "assignedToName"
  | "startDate"
  | "dueDate";
type SortDir = "asc" | "desc";

const COLUMNS: { field: SortField; label: string }[] = [
  { field: "title", label: "Name" },
  { field: "customerName", label: "Client" },
  { field: "jobName", label: "Job" },
  { field: "typeName", label: "Category" },
  { field: "statusName", label: "Status" },
  { field: "ownerName", label: "Owner" },
  { field: "assignedToName", label: "Assigned to" },
  { field: "startDate", label: "Start" },
  { field: "dueDate", label: "Due" },
];

// Owner is the permanent assignee (tasks.assignee_id); Assigned To is
// whoever currently has it in practice -- the temp assignee if a temporary
// reassignment is active, otherwise the same person as Owner.
function ownerName(t: TaskWithDetails): string {
  return t.assigneeName ?? "Unassigned";
}
function assignedToName(t: TaskWithDetails): string {
  return t.tempAssigneeName ?? t.assigneeName ?? "Unassigned";
}

const FIELD_GETTERS: Record<SortField, (t: TaskWithDetails) => string> = {
  title: (t) => t.title,
  customerName: (t) => t.customerName,
  jobName: (t) => t.jobName,
  typeName: (t) => t.typeName ?? "",
  statusName: (t) => t.statusName,
  ownerName,
  assignedToName,
  startDate: (t) => t.startDate ?? "9999-99-99",
  dueDate: (t) => t.dueDate ?? "9999-99-99",
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export default function MyWorkPageClient({
  allStaff,
  isAdmin,
  hasSessionMatch,
  defaultStaffId,
  defaultStaffName,
  initialTasks,
  jobs,
  staffOptions,
  statuses,
  taskTypes,
}: MyWorkPageClientProps) {
  const [staffId, setStaffId] = useState<string | null>(defaultStaffId);
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [loading, setLoading] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);

  const [view, setView] = useState<MasterView>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [clientFilter, setClientFilter] = useState<string>("");
  // Defaults to excluding whatever status(es) are marked complete, so a
  // completed backlog doesn't clutter the default view -- computed from the
  // actual data rather than hardcoding "Completed" as a literal.
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>(() => ({
    selected: Array.from(new Set(initialTasks.filter((t) => t.statusIsComplete).map((t) => t.statusName))),
    mode: "exclude",
  }));
  // Defaults to "Me" -- the logged-in viewer's own board, not the full
  // Partner/Manager rollup -- but stays fully changeable via the dropdown.
  const [ownerFilter, setOwnerFilter] = useState<string>(defaultStaffName ?? "");
  const [assignedToFilter, setAssignedToFilter] = useState<string>("");
  const [startFrom, setStartFrom] = useState<string>("");
  const [startTo, setStartTo] = useState<string>("");
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [columnOrder, setColumnOrder] = useState<SortField[]>(() => COLUMNS.map((c) => c.field));
  const [dragField, setDragField] = useState<SortField | null>(null);

  const orderedColumns = useMemo(
    () => columnOrder.map((field) => COLUMNS.find((c) => c.field === field)!),
    [columnOrder]
  );

  function handleColumnDrop(targetField: SortField) {
    if (!dragField || dragField === targetField) {
      setDragField(null);
      return;
    }
    setColumnOrder((prev) => {
      const next = [...prev];
      const fromIdx = next.indexOf(dragField);
      const toIdx = next.indexOf(targetField);
      next.splice(fromIdx, 1);
      next.splice(toIdx, 0, dragField);
      return next;
    });
    setDragField(null);
  }

  // Shared re-fetch used both by the admin "viewing as" override and by the
  // New Task modal's post-create refresh. Admins pass staffId explicitly (the
  // board they're currently viewing); everyone else's board is resolved from
  // their session email server-side, so staffId is only ever forwarded when
  // this session is an admin (matching the auth rule in the API route).
  const refreshTasks = useCallback(
    async (nextStaffId: string | null) => {
      setLoading(true);
      try {
        const url = isAdmin && nextStaffId ? `/api/workflow/my-work?staffId=${nextStaffId}` : "/api/workflow/my-work";
        const res = await fetch(url);
        const data = await res.json();
        setTasks(data.tasks ?? []);
      } finally {
        setLoading(false);
      }
    },
    [isAdmin]
  );

  async function handleStaffChange(nextStaffId: string) {
    setStaffId(nextStaffId);
    await refreshTasks(nextStaffId);
  }

  const today = todayIso();
  const weekEnd = addDays(today, 7);

  const clientOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.customerName))).sort(),
    [tasks]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.statusName))).sort(),
    [tasks]
  );
  const ownerOptions = useMemo(
    () => Array.from(new Set([...(defaultStaffName ? [defaultStaffName] : []), ...tasks.map(ownerName)])).sort(),
    [tasks, defaultStaffName]
  );
  const assignedToOptions = useMemo(() => Array.from(new Set(tasks.map(assignedToName))).sort(), [tasks]);

  const filtered = useMemo(() => {
    let rows = tasks;

    if (view === "overdue") rows = rows.filter((t) => toneOf(t, today, weekEnd) === "overdue");
    else if (view === "week") rows = rows.filter((t) => toneOf(t, today, weekEnd) === "overdue" || toneOf(t, today, weekEnd) === "week");
    else if (view === "completed") rows = rows.filter((t) => t.statusIsComplete);

    if (clientFilter) rows = rows.filter((t) => t.customerName === clientFilter);
    if (ownerFilter) rows = rows.filter((t) => ownerName(t) === ownerFilter);
    if (assignedToFilter) rows = rows.filter((t) => assignedToName(t) === assignedToFilter);
    if (startFrom) rows = rows.filter((t) => t.startDate && t.startDate >= startFrom);
    if (startTo) rows = rows.filter((t) => t.startDate && t.startDate <= startTo);

    // The master "Completed" view is an explicit request to see completed
    // items -- don't let the default exclude-completed status filter fight
    // it and produce an empty list.
    if (view !== "completed") {
      rows = applyStatusFilter(
        rows.map((t) => ({ ...t, rawStatus: t.statusName })),
        statusFilter
      );
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          t.customerName.toLowerCase().includes(q) ||
          t.jobName.toLowerCase().includes(q)
      );
    }

    const dir = sortDir === "asc" ? 1 : -1;
    const getField = FIELD_GETTERS[sortField];
    return [...rows].sort((a, b) => dir * getField(a).localeCompare(getField(b)));
  }, [
    tasks,
    view,
    clientFilter,
    statusFilter,
    ownerFilter,
    assignedToFilter,
    startFrom,
    startTo,
    search,
    sortField,
    sortDir,
    today,
    weekEnd,
  ]);

  function handleSort(field: SortField) {
    if (field === sortField) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("asc");
    }
  }

  if (!staffId) {
    return (
      <div>
        <PageHeader title="My Work" subtitle="Overdue, due-this-week, and upcoming work items" />
        <EmptyState
          message={
            hasSessionMatch
              ? "No staff records yet -- add a row to the staff table to trial this view."
              : "No staff record is linked to your login email yet. Ask an admin to add one with a matching email so your board can be resolved."
          }
        />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="My Work"
        subtitle={
          isAdmin
            ? "Practice work items, scoped by Partner > Manager > Staff -- resolved from your login email"
            : "Your work items, scoped by your role -- resolved from your login email"
        }
      />

      {isAdmin ? (
        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "10px", flexWrap: "wrap" }}>
          <select value={staffId} onChange={(e) => handleStaffChange(e.target.value)} style={selectStyle}>
            {allStaff.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.role})
              </option>
            ))}
          </select>
          <span style={{ fontSize: "11px", color: "#888780" }}>
            Admin override -- {hasSessionMatch ? "defaults to your own board" : `no staff row matches your login, showing ${defaultStaffName ?? "the first staff member"} by default`}.
          </span>
        </div>
      ) : null}

      {/* Master row: view selector + add filter + search, Karbon "All Work" style */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "10px 0",
          borderBottom: "0.5px solid #e1e0d9",
          flexWrap: "wrap",
        }}
      >
        <select value={view} onChange={(e) => setView(e.target.value as MasterView)} style={masterSelectStyle}>
          {MASTER_VIEWS.map((v) => (
            <option key={v.value} value={v.value}>
              {v.label}
            </option>
          ))}
        </select>

        <button type="button" onClick={() => setShowFilters((s) => !s)} style={addFilterStyle}>
          {showFilters ? "Hide filters" : "+ Add filter"}
        </button>

        <button type="button" onClick={() => setShowNewTask(true)} style={newTaskButtonStyle}>
          + New Task
        </button>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name, client, job…"
          style={searchStyle}
        />

        <span style={{ marginLeft: "auto", fontSize: "12px", color: "#888780" }}>
          {filtered.length} work item{filtered.length === 1 ? "" : "s"}
        </span>
      </div>

      {showFilters ? (
        <div style={{ display: "flex", gap: "10px", alignItems: "center", padding: "10px 0", flexWrap: "wrap" }}>
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={selectStyle}>
            <option value="">All clients</option>
            {clientOptions.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
          <StatusFilter options={statusOptions} value={statusFilter} onChange={setStatusFilter} />

          <select value={ownerFilter} onChange={(e) => setOwnerFilter(e.target.value)} style={selectStyle}>
            <option value="">All owners</option>
            {ownerOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <select value={assignedToFilter} onChange={(e) => setAssignedToFilter(e.target.value)} style={selectStyle}>
            <option value="">All assigned to</option>
            {assignedToOptions.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>

          <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "#888780" }}>
            Start
            <input type="date" value={startFrom} onChange={(e) => setStartFrom(e.target.value)} style={dateInputStyle} />
            to
            <input type="date" value={startTo} onChange={(e) => setStartTo(e.target.value)} style={dateInputStyle} />
          </label>

          {ownerFilter || assignedToFilter || startFrom || startTo || clientFilter || statusFilter.selected.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                setClientFilter("");
                setOwnerFilter("");
                setAssignedToFilter("");
                setStartFrom("");
                setStartTo("");
                setStatusFilter({ selected: [], mode: "exclude" });
              }}
              style={{ fontSize: "11px", color: "#888780", background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              Clear all
            </button>
          ) : null}
        </div>
      ) : null}

      {loading ? (
        <EmptyState message="Loading…" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No work items match the current filters." />
      ) : (
        <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", overflow: "hidden", marginTop: "12px" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "1080px" }}>
              <thead>
                <tr style={{ background: "#f5f4f0", borderBottom: "0.5px solid #e1e0d9" }}>
                  {orderedColumns.map((col) => (
                    <th
                      key={col.field}
                      draggable
                      onDragStart={() => setDragField(col.field)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        handleColumnDrop(col.field);
                      }}
                      onDragEnd={() => setDragField(null)}
                      onClick={() => handleSort(col.field)}
                      title="Click to sort · drag to reorder"
                      style={{
                        ...thStyle,
                        cursor: "grab",
                        userSelect: "none",
                        opacity: dragField === col.field ? 0.4 : 1,
                      }}
                    >
                      <span style={{ color: "#c7c5bc", marginRight: "4px" }}>⠿</span>
                      {col.label}
                      {sortField === col.field ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const tone = toneOf(t, today, weekEnd);
                  const textColor = tone === "completed" ? "#a8a69f" : "#111111";
                  const cell: React.CSSProperties = { ...tdStyle, color: textColor };
                  return (
                    <tr key={t.id} style={rowStyle(tone)}>
                      {orderedColumns.map((col) => {
                        const extra: React.CSSProperties =
                          col.field === "title"
                            ? { fontWeight: 500 }
                            : col.field === "startDate" || col.field === "dueDate"
                              ? { whiteSpace: "nowrap" }
                              : {};
                        return (
                          <td key={col.field} style={{ ...cell, ...extra }}>
                            {renderCell(col.field, t, staffId)}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showNewTask ? (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={() => refreshTasks(staffId)}
          jobs={jobs}
          staff={staffOptions}
          statuses={statuses}
          taskTypes={taskTypes}
        />
      ) : null}
    </div>
  );
}

// Column order (via drag) is independent of which field each column shows,
// so cell content is looked up by field rather than hardcoded by position.
function renderCell(field: SortField, t: TaskWithDetails, staffId: string): React.ReactNode {
  switch (field) {
    case "title": {
      const isOwner = t.assigneeId === staffId;
      return (
        <>
          {t.title}
          {t.recurrence !== "none" ? (
            <span style={{ marginLeft: "6px", fontSize: "10px", color: "#888780", fontWeight: 400 }}>
              ({RECURRENCE_LABEL[t.recurrence]})
            </span>
          ) : null}
          {t.isTemporarilyReassigned ? (
            <span
              title={
                isOwner
                  ? `Currently with ${t.tempAssigneeName ?? "someone else"} (temporary)`
                  : `Temporarily assigned ${t.tempAssigneeId === staffId ? "to you" : `to ${t.tempAssigneeName ?? "someone else"}`} -- owned by ${t.assigneeName ?? "someone else"}`
              }
              style={{ marginLeft: "6px", fontSize: "11px", color: "#9b59b6", cursor: "help" }}
            >
              ⇄
            </span>
          ) : null}
        </>
      );
    }
    case "customerName":
      return t.customerName;
    case "jobName":
      return t.jobName;
    case "typeName":
      return t.typeName ? <Chip label={t.typeName} color={t.typeColor ?? "#888780"} /> : "—";
    case "statusName":
      return <Chip label={t.statusName} color={t.statusColor} />;
    case "ownerName":
      return ownerName(t);
    case "assignedToName":
      return assignedToName(t);
    case "startDate":
      return t.startDate ?? "—";
    case "dueDate":
      return t.dueDate ?? "—";
    default:
      return null;
  }
}

function toneOf(t: TaskWithDetails, today: string, weekEnd: string): "overdue" | "week" | "normal" | "completed" {
  if (t.statusIsComplete) return "completed";
  if (t.dueDate && t.dueDate < today) return "overdue";
  if (t.dueDate && t.dueDate <= weekEnd) return "week";
  return "normal";
}

function rowStyle(tone: "overdue" | "week" | "normal" | "completed"): React.CSSProperties {
  const base: React.CSSProperties = { borderBottom: "0.5px solid #e1e0d9" };
  if (tone === "overdue") return { ...base, background: "rgba(226, 75, 74, 0.08)" };
  if (tone === "week") return { ...base, background: "rgba(237, 161, 0, 0.08)" };
  if (tone === "completed") return { ...base, color: "#a8a69f" };
  return base;
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
        marginTop: "12px",
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

const masterSelectStyle: React.CSSProperties = {
  ...selectStyle,
  fontSize: "14px",
  fontWeight: 600,
  border: "none",
  background: "none",
  padding: "6px 4px",
};

const addFilterStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "6px 12px",
  borderRadius: "999px",
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
  cursor: "pointer",
  textDecoration: "underline",
};

const newTaskButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "6px 12px",
  borderRadius: "999px",
  background: "#111111",
  color: "white",
  border: "none",
  cursor: "pointer",
};

const dateInputStyle: React.CSSProperties = {
  fontSize: "12px",
  padding: "5px 8px",
  borderRadius: "6px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
};

const searchStyle: React.CSSProperties = {
  fontSize: "12px",
  padding: "7px 12px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  minWidth: "220px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#888780",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  padding: "10px 16px",
  fontSize: "13px",
  color: "#111111",
};
