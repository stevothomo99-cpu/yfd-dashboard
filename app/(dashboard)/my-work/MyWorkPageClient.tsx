"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import StatusFilter, { applyStatusFilter, type StatusFilterValue } from "@/components/layout/StatusFilter";
import type { TaskWithDetails, WorkflowStaff } from "@/types/workflow";

interface MyWorkPageClientProps {
  allStaff: WorkflowStaff[];
  isAdmin: boolean;
  hasSessionMatch: boolean;
  defaultStaffId: string | null;
  defaultStaffName: string | null;
  initialTasks: TaskWithDetails[];
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

type SortField = "title" | "customerName" | "jobName" | "typeName" | "statusName" | "assigneeName" | "dueDate";
type SortDir = "asc" | "desc";

const COLUMNS: { field: SortField; label: string }[] = [
  { field: "title", label: "Name" },
  { field: "customerName", label: "Client" },
  { field: "jobName", label: "Job" },
  { field: "typeName", label: "Category" },
  { field: "statusName", label: "Status" },
  { field: "assigneeName", label: "Assignee" },
  { field: "dueDate", label: "Due" },
];

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
}: MyWorkPageClientProps) {
  const [staffId, setStaffId] = useState<string | null>(defaultStaffId);
  const [tasks, setTasks] = useState<TaskWithDetails[]>(initialTasks);
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<MasterView>("all");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [clientFilter, setClientFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>({ selected: [], mode: "exclude" });
  const [sortField, setSortField] = useState<SortField>("dueDate");
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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
  const weekEnd = addDays(today, 7);

  const clientOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.customerName))).sort(),
    [tasks]
  );
  const statusOptions = useMemo(
    () => Array.from(new Set(tasks.map((t) => t.statusName))).sort(),
    [tasks]
  );

  const filtered = useMemo(() => {
    let rows = tasks;

    if (view === "overdue") rows = rows.filter((t) => toneOf(t, today, weekEnd) === "overdue");
    else if (view === "week") rows = rows.filter((t) => toneOf(t, today, weekEnd) === "overdue" || toneOf(t, today, weekEnd) === "week");
    else if (view === "completed") rows = rows.filter((t) => t.statusIsComplete);

    if (clientFilter) rows = rows.filter((t) => t.customerName === clientFilter);

    rows = applyStatusFilter(
      rows.map((t) => ({ ...t, rawStatus: t.statusName })),
      statusFilter
    );

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
    return [...rows].sort((a, b) => {
      const av = (a[sortField] ?? "") as string;
      const bv = (b[sortField] ?? "") as string;
      if (sortField === "dueDate") {
        return dir * (av || "9999-99-99").localeCompare(bv || "9999-99-99");
      }
      return dir * av.localeCompare(bv);
    });
  }, [tasks, view, clientFilter, statusFilter, search, sortField, sortDir, today, weekEnd]);

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
        </div>
      ) : null}

      {loading ? (
        <EmptyState message="Loading…" />
      ) : filtered.length === 0 ? (
        <EmptyState message="No work items match the current filters." />
      ) : (
        <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", overflow: "hidden", marginTop: "12px" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", minWidth: "820px" }}>
              <thead>
                <tr style={{ background: "#f5f4f0", borderBottom: "0.5px solid #e1e0d9" }}>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.field}
                      onClick={() => handleSort(col.field)}
                      style={{ ...thStyle, cursor: "pointer", userSelect: "none" }}
                    >
                      {col.label}
                      {sortField === col.field ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((t) => {
                  const tone = toneOf(t, today, weekEnd);
                  const isOwner = t.assigneeId === staffId;
                  const textColor = tone === "completed" ? "#a8a69f" : "#111111";
                  const cell: React.CSSProperties = { ...tdStyle, color: textColor };
                  return (
                    <tr key={t.id} style={rowStyle(tone)}>
                      <td style={{ ...cell, fontWeight: 500 }}>
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
                      </td>
                      <td style={cell}>{t.customerName}</td>
                      <td style={cell}>{t.jobName}</td>
                      <td style={cell}>
                        {t.typeName ? <Chip label={t.typeName} color={t.typeColor ?? "#888780"} /> : "—"}
                      </td>
                      <td style={cell}>
                        <Chip label={t.statusName} color={t.statusColor} />
                      </td>
                      <td style={cell}>{t.assigneeName ?? "Unassigned"}</td>
                      <td style={{ ...cell, whiteSpace: "nowrap" }}>{t.dueDate ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
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
