"use client";

import { useState } from "react";
import ClientPicker from "./ClientPicker";
import type { TaskWithDetails } from "@/types/workflow";

interface ClientOption {
  id: string;
  name: string;
}

interface MoveTaskModalProps {
  task: TaskWithDetails;
  clients: ClientOption[];
  onClose: () => void;
  onMoved: () => void;
}

// Reassigns an existing task to a different client -- a quick one-field
// action for fixing a wrong client match (e.g. from Karbon Import) without
// opening the full Edit Task form. Mirrors CopyTaskModal's picker, but
// PATCHes the task in place instead of creating a new one.
export default function MoveTaskModal({ task, clients, onClose, onMoved }: MoveTaskModalProps) {
  const [clientId, setClientId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Choose a destination client.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId: clientId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to move task");
      onMoved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move task");
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
          maxWidth: "420px",
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
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>Move task to another client</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "20px", color: "#888780", cursor: "pointer", lineHeight: 1, padding: "2px 6px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "6px" }}>{task.title}</div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "18px" }}>
          Currently on <strong>{task.customerName}</strong>
          {task.karbonClientName ? ` (Karbon: ${task.karbonClientName})` : ""}
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <ClientPicker clients={clients} selectedClientId={clientId} onSelectClient={setClientId} />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={submitting || !clientId} style={{ ...primaryButtonStyle, opacity: submitting || !clientId ? 0.6 : 1 }}>
              {submitting ? "Moving…" : "Move task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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
