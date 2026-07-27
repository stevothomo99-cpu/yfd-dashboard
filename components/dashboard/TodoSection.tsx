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
// Confirmed items sort on any of their four columns; the to-confirm queue
// has no client or due date to sort by, so it carries its own narrower set.
type ConfirmedSortKey = "name" | "client" | "due" | "from";
type PendingSortKey = "name" | "from" | "received";

const NO_CLIENT = "__none";

const CONFIRMED_COLUMNS = "minmax(0, 2.2fr) minmax(0, 1.4fr) 96px minmax(0, 1fr) 214px";
const PENDING_COLUMNS = "minmax(0, 1fr) 150px";
const CONFIRMED_MIN_WIDTH = 620;
const PENDING_MIN_WIDTH = 280;

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

// Two tiles side by side rather than one list with an internal divider:
// confirmed to-dos (the working list) at 2/3 width, and the triage queue of
// items still needing a client and due date at 1/3.
//
// The filter bar sits above both and drives both, so search stays global
// across the pair rather than each tile carrying its own duplicate set of
// controls.
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
  const [showDone, setShowDone] = useState(false);

  const [confirmedSort, setConfirmedSort] = useState<ConfirmedSortKey>("due");
  const [confirmedAsc, setConfirmedAsc] = useState(true);
  const [pendingSort, setPendingSort] = useState<PendingSortKey>("received");
  const [pendingAsc, setPendingAsc] = useState(false);

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

  const today = todayIso();

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

  const allPending = todos.filter((t) => t.status === "pending_triage");
  const allConfirmed = todos.filter((t) => t.status === "todo" || t.status === "done");

  const confirmed = allConfirmed
    .filter(matches)
    .filter((t) => showDone || t.status !== "done")
    .sort((a, b) => {
      const dir = confirmedAsc ? 1 : -1;
      switch (confirmedSort) {
        case "name":
          return dir * todoDisplayName(a).localeCompare(todoDisplayName(b));
        case "client":
          return dir * (a.customerName ?? "￿").localeCompare(b.customerName ?? "￿");
        case "from":
          return dir * sourceLabel(a, currentUserEmail).localeCompare(sourceLabel(b, currentUserEmail));
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
    });

  const pending = allPending.filter(matches).sort((a, b) => {
    const dir = pendingAsc ? 1 : -1;
    switch (pendingSort) {
      case "name":
        return dir * todoDisplayName(a).localeCompare(todoDisplayName(b));
      case "from":
        return dir * sourceLabel(a, currentUserEmail).localeCompare(sourceLabel(b, currentUserEmail));
      case "received":
      default:
        return dir * a.createdAt.localeCompare(b.createdAt);
    }
  });

  const doneCount = allConfirmed.filter((t) => t.status === "done").length;
  const confirmedTotal = showDone ? allConfirmed.length : allConfirmed.length - doneCount;
  const filtersActive =
    Boolean(search.trim()) || Boolean(clientFilter) || dueFilter !== "all" || sourceFilter !== "all";

  function toggleConfirmedSort(key: ConfirmedSortKey) {
    if (confirmedSort === key) setConfirmedAsc((v) => !v);
    else {
      setConfirmedSort(key);
      setConfirmedAsc(true);
    }
  }

  function togglePendingSort(key: PendingSortKey) {
    if (pendingSort === key) setPendingAsc((v) => !v);
    else {
      setPendingSort(key);
      setPendingAsc(true);
    }
  }

  if (loading) return null;
  if (todos.length === 0 && !error) return null;

  return (
    <div style={{ marginBottom: "14px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
          marginBottom: "10px",
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
            style={{ ...controlStyle, width: "210px", maxWidth: "210px" }}
          />
          <select value={clientFilter} onChange={(e) => setClientFilter(e.target.value)} style={controlStyle} aria-label="Filter by client">
            <option value="">All clients</option>
            <option value={NO_CLIENT}>No client yet</option>
            {allClients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <select value={dueFilter} onChange={(e) => setDueFilter(e.target.value as DueFilter)} style={controlStyle} aria-label="Filter by due date">
            {DUE_FILTERS.map((d) => (
              <option key={d.value} value={d.value}>
                {d.label}
              </option>
            ))}
          </select>
          <select value={sourceFilter} onChange={(e) => setSourceFilter(e.target.value as SourceFilter)} style={controlStyle} aria-label="Filter by who sent it">
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

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "14px", alignItems: "start" }}>
        {/* Confirmed -- the actual working list. */}
        <Tile
          title="To-Do"
          count={confirmed.length}
          total={confirmedTotal}
          filtered={filtersActive}
          action={
            doneCount > 0 ? (
              <button type="button" onClick={() => setShowDone((v) => !v)} style={linkButtonStyle}>
                {showDone ? "Hide" : "Show"} {doneCount} completed
              </button>
            ) : null
          }
        >
          <div style={{ minWidth: `${CONFIRMED_MIN_WIDTH}px` }}>
            <HeaderRow columns={CONFIRMED_COLUMNS}>
              <SortHeader label="Name" sortKey="name" active={confirmedSort} asc={confirmedAsc} onClick={toggleConfirmedSort} />
              <SortHeader label="Client" sortKey="client" active={confirmedSort} asc={confirmedAsc} onClick={toggleConfirmedSort} />
              <SortHeader label="Due" sortKey="due" active={confirmedSort} asc={confirmedAsc} onClick={toggleConfirmedSort} />
              <SortHeader label="From" sortKey="from" active={confirmedSort} asc={confirmedAsc} onClick={toggleConfirmedSort} />
              <div />
            </HeaderRow>

            {confirmed.length === 0 ? (
              <EmptyRow>
                {filtersActive ? "Nothing matches these filters." : "Nothing scheduled."}
              </EmptyRow>
            ) : (
              confirmed.map((t) => {
                const isDone = t.status === "done";
                const isOverdue = Boolean(!isDone && t.dueDate && t.dueDate < today);
                return (
                  <div key={t.id} style={rowStyle(CONFIRMED_COLUMNS, isOverdue ? "overdue" : "normal")}>
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
                        style={isDone ? ghostButtonStyle : primaryButtonStyle}
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
              })
            )}
          </div>
        </Tile>

        {/* To confirm -- the triage queue. No Client/Due columns: by
            definition these items have neither yet, so the columns would be
            nothing but "Not set" repeated down the tile. */}
        <Tile
          title="To confirm"
          count={pending.length}
          total={allPending.length}
          filtered={filtersActive}
          tone="pending"
        >
          <div style={{ minWidth: `${PENDING_MIN_WIDTH}px` }}>
            <HeaderRow columns={PENDING_COLUMNS}>
              <SortHeader label="Name" sortKey="name" active={pendingSort} asc={pendingAsc} onClick={togglePendingSort} />
              <div />
            </HeaderRow>

            {pending.length === 0 ? (
              <EmptyRow>
                {filtersActive ? "Nothing matches these filters." : "Nothing to confirm."}
              </EmptyRow>
            ) : (
              pending.map((t) => (
                <div key={t.id} style={rowStyle(PENDING_COLUMNS, "pending")}>
                  <div style={{ minWidth: 0 }}>
                    <span style={nameStyle(false)}>{todoDisplayName(t)}</span>
                    <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {sourceLabel(t, currentUserEmail)} · {fmtReceived(t.createdAt)}
                    </div>
                  </div>
                  <Actions>
                    <button type="button" onClick={() => setEditing({ todo: t, mode: "populate" })} style={primaryButtonStyle}>
                      Fill in
                    </button>
                    <button type="button" onClick={() => handleDiscard(t)} disabled={busyId === t.id} style={ghostButtonStyle}>
                      Discard
                    </button>
                  </Actions>
                </div>
              ))
            )}
          </div>
        </Tile>
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

function Tile({
  title,
  count,
  total,
  filtered,
  action,
  tone,
  children,
}: {
  title: string;
  count: number;
  total: number;
  filtered: boolean;
  action?: React.ReactNode;
  tone?: "pending";
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
        minWidth: 0,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", marginBottom: "10px" }}>
        <div style={{ fontSize: "12px", fontWeight: 500, color: tone === "pending" ? "#633806" : "#111111" }}>
          {title} · {filtered && count !== total ? `${count} of ${total}` : total}
        </div>
        {action}
      </div>
      {/* Each tile scrolls its own columns rather than squashing them --
          the dashboard isn't mobile-optimised, but a narrow laptop
          shouldn't make the action buttons unreachable. */}
      <div style={{ overflowX: "auto" }}>{children}</div>
    </div>
  );
}

function HeaderRow({ columns, children }: { columns: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: columns,
        gap: "10px",
        padding: "0 10px 8px",
        borderBottom: "0.5px solid #e1e0d9",
        marginBottom: "6px",
      }}
    >
      {children}
    </div>
  );
}

function SortHeader<K extends string>({
  label,
  sortKey,
  active,
  asc,
  onClick,
}: {
  label: string;
  sortKey: K;
  active: K;
  asc: boolean;
  onClick: (key: K) => void;
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

function EmptyRow({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "12px", color: "#888780", padding: "14px 10px" }}>{children}</div>;
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
  return <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end", alignItems: "center" }}>{children}</div>;
}

function rowStyle(columns: string, tone: "pending" | "overdue" | "normal"): React.CSSProperties {
  return {
    display: "grid",
    gridTemplateColumns: columns,
    gap: "10px",
    alignItems: "center",
    padding: "9px 10px",
    marginBottom: "6px",
    background: tone === "pending" ? "#FAEEDA" : "#fafaf8",
    border:
      tone === "pending"
        ? "0.5px solid #f0d9a8"
        : tone === "overdue"
          ? "0.5px solid #f0b8b8"
          : "0.5px solid transparent",
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

const controlStyle: React.CSSProperties = {
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

const primaryButtonStyle: React.CSSProperties = {
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
