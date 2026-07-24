"use client";

import { useState } from "react";
import ClientJobPicker from "./ClientJobPicker";
import type { RecurrenceInterval, TodoItem } from "@/types/workflow";

interface ClientOption {
  id: string;
  name: string;
}

interface PopulateTodoModalProps {
  todo: TodoItem;
  allClients: ClientOption[];
  onClose: () => void;
  onSaved: () => void;
}

const RECURRENCE_OPTIONS: { value: RecurrenceInterval; label: string }[] = [
  { value: "none", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

// Fills in the client/due-date/recurrence a forwarded-email to-do doesn't
// have yet. One-off stays a lightweight to-do; anything recurring converts
// it into a real Task instead (see lib/todos.ts's populateTodoItem) since
// recurring work needs the full Task machinery a to-do doesn't have.
export default function PopulateTodoModal({ todo, allClients, onClose, onSaved }: PopulateTodoModalProps) {
  const [clientId, setClientId] = useState("");
  const [jobId, setJobId] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>("none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [convertedMessage, setConvertedMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) {
      setError("Choose a client.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/todos/${todo.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: clientId,
          dueDate: dueDate || null,
          recurrence,
          jobId: jobId || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      if (data.converted) {
        setConvertedMessage("Converted into a task on that client's board.");
        setTimeout(() => {
          onSaved();
          onClose();
        }, 1200);
      } else {
        onSaved();
        onClose();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
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
          maxWidth: "440px",
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
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>To-do details</div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "20px", color: "#888780", cursor: "pointer", lineHeight: 1, padding: "2px 6px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "18px" }}>{todo.subject}</div>

        {convertedMessage ? (
          <div style={{ fontSize: "13px", color: "#0d4a2f", background: "#e3f6ec", border: "0.5px solid #b8e6cd", borderRadius: "10px", padding: "10px 12px" }}>
            {convertedMessage}
          </div>
        ) : (
          <>
            {error ? (
              <div style={{ fontSize: "12px", color: "#501313", background: "#FCEBEB", border: "0.5px solid #f0b8b8", borderRadius: "10px", padding: "8px 12px", marginBottom: "16px" }}>
                {error}
              </div>
            ) : null}

            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <ClientJobPicker
                clients={allClients}
                selectedClientId={clientId}
                onSelectClient={setClientId}
                selectedJobId={jobId}
                onSelectJob={setJobId}
              />

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={labelStyle}>Due date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
              </label>

              <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={labelStyle}>Recurrence</span>
                <select value={recurrence} onChange={(e) => setRecurrence(e.target.value as RecurrenceInterval)} style={inputStyle}>
                  {RECURRENCE_OPTIONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </select>
                {recurrence !== "none" ? (
                  <span style={{ fontSize: "11px", color: "#888780" }}>
                    Recurring items become a real Task on the client&rsquo;s board instead of staying a to-do.
                  </span>
                ) : null}
              </label>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
                <button type="button" onClick={onClose} style={secondaryButtonStyle}>
                  Cancel
                </button>
                <button type="submit" disabled={submitting || !clientId} style={{ ...primaryButtonStyle, opacity: submitting || !clientId ? 0.6 : 1 }}>
                  {submitting ? "Saving…" : "Save"}
                </button>
              </div>
            </form>
          </>
        )}
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
