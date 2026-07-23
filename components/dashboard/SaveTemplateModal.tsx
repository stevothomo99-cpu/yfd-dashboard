"use client";

import { useState } from "react";
import type { TaskWithDetails } from "@/types/workflow";

interface SaveTemplateModalProps {
  customerName: string;
  tasks: TaskWithDetails[];
  onClose: () => void;
  onSaved: () => void;
}

// Saves a chosen subset of the client's current tasks as a named, reusable
// template -- only title/type/recurrence are captured (see
// lib/workflow.ts's saveTasksAsTemplate); dates, assignee, and completion
// state are intentionally left behind since a template is a shape to
// reuse elsewhere, not a snapshot of this client's actual schedule.
export default function SaveTemplateModal({ customerName, tasks, onClose, onSaved }: SaveTemplateModalProps) {
  const [name, setName] = useState(`${customerName} tasks`);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set(tasks.map((t) => t.id)));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Template name is required.");
      return;
    }
    if (selectedIds.size === 0) {
      setError("Select at least one task to include.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/workflow/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), taskIds: Array.from(selectedIds) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save template");
      onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save template");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 17, 17, 0.35)",
        zIndex: 200,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "460px",
          maxHeight: "90vh",
          overflow: "auto",
          background: "white",
          borderRadius: "14px",
          border: "0.5px solid #e1e0d9",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>Save tasks as template</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "20px", color: "#888780", cursor: "pointer", lineHeight: 1, padding: "2px 6px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error ? (
          <div
            style={{
              fontSize: "12px",
              color: "#501313",
              background: "#FCEBEB",
              border: "0.5px solid #f0b8b8",
              borderRadius: "10px",
              padding: "8px 12px",
              marginBottom: "16px",
            }}
          >
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyle}>Template name *</span>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              style={inputStyle}
            />
          </label>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyle}>Tasks to include · {selectedIds.size} of {tasks.length}</span>
            {tasks.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#888780" }}>This client has no tasks yet.</div>
            ) : (
              <div
                style={{
                  maxHeight: "260px",
                  overflowY: "auto",
                  border: "0.5px solid #e1e0d9",
                  borderRadius: "8px",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {tasks.map((t) => (
                  <label
                    key={t.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "8px 12px",
                      borderBottom: "0.5px solid #e1e0d9",
                      fontSize: "13px",
                      color: "#111111",
                      cursor: "pointer",
                    }}
                  >
                    <input type="checkbox" checked={selectedIds.has(t.id)} onChange={() => toggle(t.id)} />
                    <span style={{ flex: 1 }}>{t.title}</span>
                    {t.typeName ? <span style={{ fontSize: "11px", color: "#888780" }}>{t.typeName}</span> : null}
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || tasks.length === 0}
              style={{ ...primaryButtonStyle, opacity: submitting || tasks.length === 0 ? 0.6 : 1 }}
            >
              {submitting ? "Saving…" : "Save template"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px",
  fontWeight: 500,
  color: "#888780",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  fontFamily: "inherit",
  width: "100%",
};

const primaryButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "8px 16px",
  borderRadius: "999px",
  background: "#111111",
  color: "white",
  border: "none",
  cursor: "pointer",
};

const secondaryButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "8px 16px",
  borderRadius: "999px",
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
  cursor: "pointer",
};
