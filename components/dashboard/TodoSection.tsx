"use client";

import { useEffect, useMemo, useState } from "react";
import PopulateTodoModal from "./PopulateTodoModal";
import { todoDisplayName } from "@/lib/utils";
import type { TodoItem } from "@/types/workflow";

interface ClientOption {
  id: string;
  name: string;
}

interface TodoSectionProps {
  allClients: ClientOption[];
  // Used only to tell "I forwarded this myself" apart from "a colleague
  // delegated this to me" -- see sourceOf(). Null when the logged-in user
  // has no email on the session, in which case everything reads as
  // delegated rather than guessing.
  currentUserEmail: string | null;
}

type DueFilter = "all" | "overdue" | "week" | "month" | "none";
type SourceFilter = "all" | "self" | "others";
type SortKey = "name" | "client" | "due" | "from";

const NO_CLIENT = "__none";

// Shared by the header row and every data row so the columns actually line
// up: Name | Client | Due | From | actions.
const GRID_COLUMNS = "minmax(0, 2.4fr) minmax(0, 1.4fr) 108px minmax(0, 1.1fr) 232px";
const MIN_TABLE_WIDTH = 760;

const DUE_FILTERS: { value: DueFilter; label: string }[] = [
  { value: "all", label: "Any due date" },
  { value: "overdue", label: "Overdue" },
  { value: "week", label: "Due next 7 days" },
  { value: "month", label: "Due next 30 days" },
  { value: "none", label: "No due date" },
];

const SOURCE_FILTERS: { value: SourceFilter; label: string }[] = [
  { value: "all", label: "Anyone" },
  { value: "self", label: "From me" },
  { value: "others", label: "From others" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

function fmtReceived(iso: string): string {
  return new Date(iso).toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// "self" when the person who forwarded the email is also the owner reading
// it; "others" when a colleague forwarded it on their behalf (the inbound
// webhook's Cc-delegation path -- see app/api/email/inbound/route.ts).
function sourceOf(todo: TodoItem, currentUserEmail: string | null): "self" | "others" {
  if (!currentUserEmail || !todo.createdByEmail) return "others";
  return todo.createdByEmail.toLowerCase() === currentUserEmail.toLowerCase() ? "self" : "others";
}

function sourceLabel(todo: TodoItem, currentUserEmail: string | null): string {
  if (sourceOf(todo, currentUserEmail) === "self") return "Me";
  return todo.createdByName?.trim() || todo.createdByEmail || "Someone else";
}

// Lightweight email-forwarded to-dos -- see app/api/email/inbound/route.ts
// for how they're created and lib/todos.ts for the pending_triage ->
// todo/done/converted lifecycle. Fetches its own data (rather than being
// server-rendered) since it needs to refresh after populate/done/discard
// actions without a full page reload.
export default function TodoSection({ allClients, currentUserEmail }: TodoSectionProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ todo: TodoItem; mode: "populate" | "edit" } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [clientFilter, setClientFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("due");
  const [sortAsc, setSortAsc] = useState(true);
  const [showDone, setShowDone] = useState(false);

  async function refresh() {
    try {
      const res = await fetch("/api/todos");
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load to-dos");
      setTodos(data.todos ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load to-dos");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch("/api/todos");
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load to-dos");
        setTodos(data.todos ?? []);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load to-dos");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSetDone(todo: TodoItem, done: boolean) {
    setBusyId(todo.id);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done }),
      });
      if (!res.ok) throw new Error("Failed to update");
      await refresh();
    } catch {
      setError("Failed to update to-do");
    } finally {
      setBusyId(null);
    }
  }

  async function handleDiscard(todo: TodoItem) {
    if (!window.confirm(`Discard "${todoDisplayName(todo)}"?`)) return;
    setBusyId(todo.id);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to discard");
      await refresh();
    } catch {
      setError("Failed to discard to-do");
    } finally {
      setBusyId(null);
    }
  }

  function toggleSort(key: SortKey) {
    if (sortBy === key) setSortAsc((v) => !v);
    else {
      setSortBy(key);
      setSortAsc(true);
    }
  }

  const today = todayIso();

  // Filters apply to both groups. A client/due-date filter necessarily
  // excludes every pending item (they have neither yet) -- the group
  // headers report "x of y" so that's visible rather than looking like the
  // items vanished.
  const matches = useMemo(() => {
    const weekEnd = addDays(today, 7);
    const monthEnd = addDays(today, 30);
    const q = search.trim().toLowerCase();

    return (t: TodoItem): boolean => {
      // Global search spans everything visible in a row plus the original
      // email subject, so searching still finds a renamed item by what the
      // email was actually called.
      if (q) {
        const haystack = [
          todoDisplayName(t),
          t.subject,
          t.customerName ?? "",
          t.createdByName ?? "",
          t.createdByEmail ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }

      if (clientFilter) {
        if (clientFilter === NO_CLIENT ? Boolean(t.customerId) : t.customerId !== clientFilter) return false;
      }
      if (sourceFilter !== "all" && sourceOf(t, currentUserEmail) !== sourceFilter) return false;

      switch (dueFilter) {
        case "overdue":
          return Boolean(t.dueDate && t.dueDate < today);
        case "week":
          return Boolean(t.dueDate && t.dueDate >= today && t.dueDate <= weekEnd);
        case "month":
          return Boolean(t.dueDate && t.dueDate >= today && t.dueDate <= monthEnd);
        case "none":
          return !t.dueDate;
        default:
          return true;
      }
    };
  }, [search, clientFilter, dueFilter, sourceFilter, currentUserEmail, today]);

  const sorter = useMemo(() => {
    const dir = sortAsc ? 1 : -1;
    return (a: TodoItem, b: TodoItem): number => {
      switch (sortBy) {
        case "name":
          return dir * todoDisplayName(a).localeCompare(todoDisplayName(b));
        case "client":
          return dir * (a.customerName ?? "￿").localeCompare(b.customerName ?? "￿");
        case "from":
          return (
            dir * sourceLabel(a, currentUserEmail).localeCompare(sourceLabel(b, currentUserEmail))
          );
        case "due":
        default:
          // Undated items sort last in both directions rather than flipping
          // to the top -- "no due date" isn't a date, so it shouldn't
          // outrank one.
          if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt);
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return dir * a.dueDate.localeCompare(b.dueDate);
      }
    };
  }, [sortBy, sortAsc, currentUserEmail]);

  const allPending = todos.filter((t) => t.status === "pending_triage");
  const allScheduled = todos.filter((t) => t.status === "todo" || t.status === "done");

  const pending = allPending.filter(matches).sort(sorter);
  const scheduled = allScheduled
    .filter(matches)
    .filter((t) => showDone || t.status !== "done")
    .sort(sorter);

  const doneCount = allScheduled.filter((t) => t.status === "done").length;
  const filtersActive =
    Boolean(search.trim()) || Boolean(clientFilter) || dueFilter !== "all" || sourceFilter !== "all";

  if (loading) return null;
  if (todos.length === 0 && !error) return null;

  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
        marginBottom: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
          To-Do{todos.length ? ` · ${todos.length}` : ""}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, client, sender…"
            aria-label="Search to-dos"
            style={{ ...selectStyle, width: "210px", maxWidth: "210px" }}
          />

          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={selectStyle} aria-label="Filter by client">
            <option value="">All clients</option>
            <option value={NO_CLIENT}>No client yet</option>
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as DueFilter)} style={selectStyle} aria-label="Filter by due date">
            {DUE_FILTERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>

          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} style={selectStyle} aria-label="Filter by who sent it">
            {SOURCE_FILTERS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setClientFilter("");
                setDueFilter("all");
                setSourceFilter("all");
              }}
              style={ghostButtonStyle}
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div style={{ fontSize: "12px", color: "#501313", background: "#FCEBEB", border: "0.5px solid #f0b8b8", borderRadius: "10px", padding: "8px 12px", marginBottom: "12px" }}>
          {error}
        </div>
      ) : null}

      {/* The grid needs a floor width to stay readable as columns; below
          that the table scrolls sideways rather than crushing every cell. */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ minWidth: `${MIN_TABLE_WIDTH}px` }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: GRID_COLUMNS,
              gap: "12px",
              padding: "0 12px 8px",
              borderBottom: "0.5px solid #e1e0d9",
            }}
          >
            <SortHeader label="Name" sortKey="name" active={sortBy} asc={sortAsc} onClick={toggleSort} />
            <SortHeader label="Client" sortKey="client" active={sortBy} asc={sortAsc} onClick={toggleSort} />
            <SortHeader label="Due" sortKey="due" active={sortBy} asc={sortAsc} onClick={toggleSort} />
            <SortHeader label="From" sortKey="from" active={sortBy} asc={sortAsc} onClick={toggleSort} />
            <div />
          </div>

          {allPending.length > 0 ? (
            <>
              <GroupRow
                label="Needs client + due date"
                shown={pending.length}
                total={allPending.length}
                filtered={filtersActive}
              />
              {pending.map((t) => (
                <div key={t.id} style={rowStyle({ tone: "pending" })}>
                  <Cell>
                    <span style={nameStyle(false)}>{todoDisplayName(t)}</span>
                  </Cell>
                  <Cell muted>Not set</Cell>
                  <Cell muted>Not set</Cell>
                  <Cell muted>
                    {sourceLabel(t, currentUserEmail)}
                    <span style={{ color: "#b4b2a9" }}> · {fmtReceived(t.createdAt)}</span>
                  </Cell>
                  <Actions>
                    <button type="button" onClick={() => setEditing({ todo: t, mode: "populate" })} style={primaryGhostButtonStyle}>
                      Fill in
                    </button>
                    <button type="button" onClick={() => handleDiscard(t)} disabled={busyId === t.id} style={ghostButtonStyle}>
                      Discard
                    </button>
                  </Actions>
                </div>
              ))}
            </>
          ) : null}

          {allScheduled.length > 0 ? (
            <>
              <GroupRow
                label="Scheduled"
                shown={scheduled.length}
                total={showDone ? allScheduled.length : allScheduled.length - doneCount}
                filtered={filtersActive}
                action={
                  doneCount > 0 ? (
                    <button type="button" onClick={() => setShowDone((v) => !v)} style={linkButtonStyle}>
                      {showDone ? "Hide" : "Show"} {doneCount} completed
                    </button>
                  ) : null
                }
              />
              {scheduled.map((t) => {
                const isDone = t.status === "done";
                const isOverdue = Boolean(!isDone && t.dueDate && t.dueDate < today);
                return (
                  <div key={t.id} style={rowStyle({ tone: isOverdue ? "overdue" : "normal" })}>
                    <Cell>
                      <span style={nameStyle(isDone)}>{todoDisplayName(t)}</span>
                    </Cell>
                    <Cell muted={!t.customerName}>{t.customerName ?? "No client"}</Cell>
                    <Cell muted={!t.dueDate}>
                      {t.dueDate ? (
                        <span style={isOverdue ? { color: "#A32D2D", fontWeight: 500 } : undefined}>
                          {fmtDate(t.dueDate)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Cell>
                    <Cell muted>{sourceLabel(t, currentUserEmail)}</Cell>
                    <Actions>
                      <button
                        type="button"
                        onClick={() => handleSetDone(t, !isDone)}
                        disabled={busyId === t.id}
                        style={isDone ? ghostButtonStyle : primaryGhostButtonStyle}
                      >
                        {isDone ? "Reopen" : "Complete"}
                      </button>
                      <button type="button" onClick={() => setEditing({ todo: t, mode: "edit" })} style={ghostButtonStyle}>
                        Edit
                      </button>
                      <button type="button" onClick={() => handleDiscard(t)} disabled={busyId === t.id} style={ghostButtonStyle}>
                        Discard
                      </button>
                    </Actions>
                  </div>
                );
              })}
            </>
          ) : null}

          {pending.length === 0 && scheduled.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#888780", padding: "16px 12px" }}>
              {filtersActive ? "No to-dos match these filters." : "Nothing outstanding."}
            </div>
          ) : null}
        </div>
      </div>

      {editing ? (
        <PopulateTodoModal
          todo={editing.todo}
          allClients={allClients}
          mode={editing.mode}
          onClose={() => setEditing(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  active,
  asc,
  onClick,
}: {
  label: string;
  sortKey: SortKey;
  active: SortKey;
  asc: boolean;
  onClick: (key: SortKey) => void;
}) {
  const isActive = active === sortKey;
  return (
    <button
      type="button"
      onClick={() => onClick(sortKey)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        background: "transparent",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: "10px",
        fontWeight: 500,
        color: isActive ? "#111111" : "#888780",
        textTransform: "uppercase",
        letterSpacing: "0.06em",
        fontFamily: "inherit",
        textAlign: "left",
      }}
      aria-label={`Sort by ${label}`}
    >
      {label}
      <span style={{ opacity: isActive ? 1 : 0 }}>{asc ? "▲" : "▼"}</span>
    </button>
  );
}

// A full-width band separating the two halves of the list: items still
// needing triage vs. ones already given a client and due date.
function GroupRow({
  label,
  shown,
  total,
  filtered,
  action,
}: {
  label: string;
  shown: number;
  total: number;
  filtered: boolean;
  action?: React.ReactNode;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "12px",
        padding: "14px 12px 6px",
      }}
    >
      <div style={{ fontSize: "10px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label} · {filtered && shown !== total ? `${shown} of ${total}` : total}
      </div>
      {action}
    </div>
  );
}

function Cell({ children, muted }: { children: React.ReactNode; muted?: boolean }) {
  return (
    <div
      style={{
        fontSize: "12px",
        color: muted ? "#888780" : "#444441",
        minWidth: 0,
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        alignSelf: "center",
      }}
    >
      {children}
    </div>
  );
}

function Actions({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>{children}</div>;
}

function rowStyle({ tone }: { tone: "pending" | "overdue" | "normal" }): React.CSSProperties {
  const background = tone === "pending" ? "#FAEEDA" : "#fafaf8";
  const border =
    tone === "pending" ? "0.5px solid #f0d9a8" : tone === "overdue" ? "0.5px solid #f0b8b8" : "0.5px solid transparent";
  return {
    display: "grid",
    gridTemplateColumns: GRID_COLUMNS,
    gap: "12px",
    alignItems: "center",
    padding: "9px 12px",
    marginBottom: "6px",
    background,
    border,
    borderRadius: "8px",
  };
}

function nameStyle(isDone: boolean): React.CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: 500,
    color: isDone ? "#888780" : "#111111",
    textDecoration: isDone ? "line-through" : "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    display: "block",
  };
}

const selectStyle: React.CSSProperties = {
  fontSize: "11px",
  padding: "5px 8px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#444441",
  outline: "none",
  fontFamily: "inherit",
  maxWidth: "170px",
};

const ghostButtonStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  padding: "5px 11px",
  borderRadius: "999px",
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
  cursor: "pointer",
  flexShrink: 0,
};

const primaryGhostButtonStyle: React.CSSProperties = {
  ...ghostButtonStyle,
  background: "#111111",
  color: "white",
  border: "0.5px solid #111111",
};

const linkButtonStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  padding: 0,
  background: "transparent",
  color: "#2a78d6",
  border: "none",
  cursor: "pointer",
};
