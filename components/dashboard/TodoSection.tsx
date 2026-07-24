"use client";

import { useEffect, useState } from "react";
import PopulateTodoModal from "./PopulateTodoModal";
import type { TodoItem } from "@/types/workflow";

interface ClientOption {
  id: string;
  name: string;
}

interface TodoSectionProps {
  allClients: ClientOption[];
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

// Lightweight email-forwarded to-dos -- see app/api/email/inbound/route.ts
// for how they're created and lib/todos.ts for the pending_triage ->
// todo/done/converted lifecycle. Fetches its own data (rather than being
// server-rendered) since it needs to refresh after populate/done/discard
// actions without a full page reload.
export default function TodoSection({ allClients }: TodoSectionProps) {
  const [todos, setTodos] = useState<TodoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [populating, setPopulating] = useState<TodoItem | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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

  async function handleToggleDone(todo: TodoItem) {
    setBusyId(todo.id);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ done: todo.status !== "done" }),
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

  if (loading) return null;
  if (todos.length === 0 && !error) return null;

  const pending = todos.filter((t) => t.status === "pending_triage");
  const populated = todos.filter((t) => t.status === "todo" || t.status === "done");

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
      <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "12px" }}>
        To-Do{todos.length ? ` · ${todos.length}` : ""}
      </div>

      {error ? (
        <div style={{ fontSize: "12px", color: "#501313", background: "#FCEBEB", border: "0.5px solid #f0b8b8", borderRadius: "10px", padding: "8px 12px", marginBottom: "12px" }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {pending.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "10px 12px",
              background: "#FAEEDA",
              border: "0.5px solid #f0d9a8",
              borderRadius: "8px",
            }}
          >
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {t.subject}
              </div>
              <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                {t.createdByName ? `From ${t.createdByName} · ` : ""}Needs client + due date
              </div>
            </div>
            <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
              <button type="button" onClick={() => setPopulating(t)} style={ghostButtonStyle}>
                Fill in
              </button>
              <button type="button" onClick={() => handleDiscard(t)} disabled={busyId === t.id} style={ghostButtonStyle}>
                Discard
              </button>
            </div>
          </div>
        ))}

        {populated.map((t) => (
          <div
            key={t.id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              padding: "10px 12px",
              background: "#fafaf8",
              borderRadius: "8px",
            }}
          >
            <label style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={t.status === "done"}
                disabled={busyId === t.id}
                onChange={() => handleToggleDone(t)}
              />
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 500,
                    color: t.status === "done" ? "#888780" : "#111111",
                    textDecoration: t.status === "done" ? "line-through" : "none",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.subject}
                </div>
                <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                  {t.customerName ?? "—"} · {t.dueDate ? `Due ${fmtDate(t.dueDate)}` : "No due date"}
                </div>
              </div>
            </label>
            <button type="button" onClick={() => handleDiscard(t)} disabled={busyId === t.id} style={ghostButtonStyle}>
              Discard
            </button>
          </div>
        ))}
      </div>

      {populating ? (
        <PopulateTodoModal
          todo={populating}
          allClients={allClients}
          onClose={() => setPopulating(null)}
          onSaved={refresh}
        />
      ) : null}
    </div>
  );
}

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
