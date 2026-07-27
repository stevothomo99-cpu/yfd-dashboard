"use client";

import { useEffect, useMemo, useState } from "react";
import PopulateTodoModal from "./PopulateTodoModal";
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
type SortKey = "due" | "client" | "subject" | "newest";

const NO_CLIENT = "__none";

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

const SORTS: { value: SortKey; label: string }[] = [
  { value: "due", label: "Due date" },
  { value: "client", label: "Client" },
  { value: "subject", label: "Subject" },
  { value: "newest", label: "Newest first" },
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
  if (sourceOf(todo, currentUserEmail) === "self") return "From me";
  const who = todo.createdByName?.trim() || todo.createdByEmail;
  return who ? `From ${who}` : "From someone else";
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

  const [clientFilter, setClientFilter] = useState("");
  const [dueFilter, setDueFilter] = useState<DueFilter>("all");
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>("all");
  const [sortBy, setSortBy] = useState<SortKey>("due");
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
    if (!window.confirm(`Discard "${todo.subject}"?`)) return;
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

  const today = todayIso();

  // Filters apply to both groups. A client/due-date filter necessarily
  // excludes every pending item (they have neither yet) -- the group
  // headers report "x of y" so that's visible rather than looking like the
  // items vanished.
  const matches = useMemo(() => {
    const weekEnd = addDays(today, 7);
    const monthEnd = addDays(today, 30);

    return (t: TodoItem): boolean => {
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
  }, [clientFilter, dueFilter, sourceFilter, currentUserEmail, today]);

  const sorter = useMemo(() => {
    return (a: TodoItem, b: TodoItem): number => {
      switch (sortBy) {
        case "client":
          return (a.customerName ?? "￿").localeCompare(b.customerName ?? "￿");
        case "subject":
          return a.subject.localeCompare(b.subject);
        case "newest":
          return b.createdAt.localeCompare(a.createdAt);
        case "due":
        default:
          // Undated items sort last rather than first, so the soonest real
          // deadline is always at the top.
          if (!a.dueDate && !b.dueDate) return b.createdAt.localeCompare(a.createdAt);
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return a.dueDate.localeCompare(b.dueDate);
      }
    };
  }, [sortBy]);

  const allPending = todos.filter((t) => t.status === "pending_triage");
  const allScheduled = todos.filter((t) => t.status === "todo" || t.status === "done");

  const pending = allPending.filter(matches).sort(sorter);
  const scheduled = allScheduled
    .filter(matches)
    .filter((t) => showDone || t.status !== "done")
    .sort(sorter);

  const doneCount = allScheduled.filter((t) => t.status === "done").length;
  const filtersActive = Boolean(clientFilter) || dueFilter !== "all" || sourceFilter !== "all";

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

          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortKey)} style={selectStyle} aria-label="Sort by">
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                Sort: {s.label}
              </option>
            ))}
          </select>

          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
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

      {allPending.length > 0 ? (
        <>
          <GroupHeader
            label="Needs client + due date"
            shown={pending.length}
            total={allPending.length}
            filtered={filtersActive}
          />
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {pending.map((t) => (
              <div key={t.id} style={pendingRowStyle}>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={titleStyle(false)}>{t.subject}</div>
                  <div style={metaStyle}>
                    {sourceLabel(t, currentUserEmail)} · Received {fmtReceived(t.createdAt)}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button type="button" onClick={() => setEditing({ todo: t, mode: "populate" })} style={ghostButtonStyle}>
                    Fill in
                  </button>
                  <button type="button" onClick={() => handleDiscard(t)} disabled={busyId === t.id} style={ghostButtonStyle}>
                    Discard
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : null}

      {allScheduled.length > 0 ? (
        <>
          <GroupHeader
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
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {scheduled.map((t) => {
              const isDone = t.status === "done";
              const isOverdue = Boolean(!isDone && t.dueDate && t.dueDate < today);
              return (
                <div key={t.id} style={scheduledRowStyle(isOverdue)}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={titleStyle(isDone)}>{t.subject}</div>
                    <div style={metaStyle}>
                      {t.customerName ?? "No client"}
                      {" · "}
                      {t.dueDate ? (
                        <span style={isOverdue ? { color: "#A32D2D", fontWeight: 500 } : undefined}>
                          {isOverdue ? "Overdue " : "Due "}
                          {fmtDate(t.dueDate)}
                        </span>
                      ) : (
                        "No due date"
                      )}
                      {" · "}
                      {sourceLabel(t, currentUserEmail)}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
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
                  </div>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {pending.length === 0 && scheduled.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#888780", padding: "12px 0" }}>
          {filtersActive ? "No to-dos match these filters." : "Nothing outstanding."}
        </div>
      ) : null}

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

// The separator between the two halves of the list: items still needing
// triage vs. ones already given a client and due date.
function GroupHeader({
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
        marginTop: "16px",
        marginBottom: "8px",
        paddingTop: "12px",
        borderTop: "0.5px solid #e1e0d9",
      }}
    >
      <div style={{ fontSize: "10px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label} · {filtered && shown !== total ? `${shown} of ${total}` : total}
      </div>
      {action}
    </div>
  );
}

const pendingRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: "12px",
  padding: "10px 12px",
  background: "#FAEEDA",
  border: "0.5px solid #f0d9a8",
  borderRadius: "8px",
};

function scheduledRowStyle(isOverdue: boolean): React.CSSProperties {
  return {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    padding: "10px 12px",
    background: "#fafaf8",
    border: isOverdue ? "0.5px solid #f0b8b8" : "0.5px solid transparent",
    borderRadius: "8px",
  };
}

function titleStyle(isDone: boolean): React.CSSProperties {
  return {
    fontSize: "13px",
    fontWeight: 500,
    color: isDone ? "#888780" : "#111111",
    textDecoration: isDone ? "line-through" : "none",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  };
}

const metaStyle: React.CSSProperties = {
  fontSize: "11px",
  color: "#888780",
  marginTop: "2px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

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
  padding: "5px 12px",
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
