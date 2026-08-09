"use client";

import { useState } from "react";
import type { TaskWithDetails } from "@/types/workflow";

interface CombineTaskModalProps {
  task: TaskWithDetails;
  candidates: TaskWithDetails[];
  onClose: () => void;
  onCombined: () => void;
}

// Merges `task` into another task and deletes it -- for cleaning up
// duplicates (e.g. re-running Karbon Import before dedupe existed created
// one task per re-import of the same WorkItem). Defaults the candidate list
// to the same client, since that's overwhelmingly where a duplicate would
// be, but a search box reaches any task in case the duplicate landed on the
// wrong client too.
export default function CombineTaskModal({ task, candidates, onClose, onCombined }: CombineTaskModalProps) {
  const [search, setSearch] = useState("");
  const [sameClientOnly, setSameClientOnly] = useState(true);
  const [targetId, setTargetId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pool = sameClientOnly ? candidates.filter((c) => c.customerId === task.customerId) : candidates;
  const filtered = search.trim()
    ? pool.filter(
        (c) =>
          c.title.toLowerCase().includes(search.trim().toLowerCase()) ||
          c.customerName.toLowerCase().includes(search.trim().toLowerCase())
      )
    : pool;

  async function handleCombine() {
    if (!targetId) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/tasks/${task.id}/combine`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intoTaskId: targetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to combine tasks");
      onCombined();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to combine tasks");
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "4px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>Combine into another task</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "20px", color: "#888780", cursor: "pointer", lineHeight: 1, padding: "2px 6px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "18px" }}>
          &ldquo;{task.title}&rdquo; ({task.customerName}) will be deleted; the task you pick below is kept, backfilled
          with anything it&apos;s missing (assignee, category, dates, Karbon reference) from this one.
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

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks…"
              style={inputStyle}
            />
            <label style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "11px", color: "#888780", whiteSpace: "nowrap" }}>
              <input type="checkbox" checked={sameClientOnly} onChange={(e) => setSameClientOnly(e.target.checked)} />
              Same client
            </label>
          </div>

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
            {filtered.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#888780", padding: "10px 12px" }}>No matching tasks.</div>
            ) : (
              filtered.map((c) => {
                const active = c.id === targetId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setTargetId(c.id)}
                    style={{
                      textAlign: "left",
                      fontSize: "13px",
                      padding: "8px 12px",
                      border: "none",
                      borderBottom: "0.5px solid #e1e0d9",
                      background: active ? "#111111" : "white",
                      color: active ? "white" : "#111111",
                      cursor: "pointer",
                    }}
                  >
                    <div>{c.title}</div>
                    <div style={{ fontSize: "11px", color: active ? "#c7c5bc" : "#888780" }}>{c.customerName}</div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "18px" }}>
          <button type="button" onClick={onClose} style={secondaryButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={handleCombine}
            disabled={submitting || !targetId}
            style={{ ...primaryButtonStyle, opacity: submitting || !targetId ? 0.6 : 1 }}
          >
            {submitting ? "Combining…" : "Combine"}
          </button>
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  fontSize: "13px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  fontFamily: "inherit",
  flex: 1,
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
