"use client";

import type { TaskWithDetails } from "@/types/workflow";

interface DeleteTaskDialogProps {
  task: TaskWithDetails;
  onClose: () => void;
  onConfirm: (scope: "occurrence" | "series") => void;
}

// A plain confirm() only offers OK/Cancel -- two choices -- but a recurring
// task's delete needs three: cancel, this occurrence only, or the whole
// linked series. Only shown for tasks with recurrence !== "none"; a one-off
// task keeps the plain window.confirm it always had.
export default function DeleteTaskDialog({ task, onClose, onConfirm }: DeleteTaskDialogProps) {
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 17, 17, 0.35)",
        zIndex: 300,
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
          maxWidth: "400px",
          background: "white",
          borderRadius: "14px",
          border: "0.5px solid #e1e0d9",
          padding: "24px",
          boxShadow: "0 8px 32px rgba(0,0,0,0.12)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111", marginBottom: "6px" }}>
          Delete recurring task
        </div>
        <div style={{ fontSize: "13px", color: "#444441", marginBottom: "4px" }}>{task.title}</div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "20px" }}>
          This is part of a linked, repeating series. Delete just this occurrence, or the whole series?
          Completed occurrences are kept either way, as a record of work done.
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <button type="button" onClick={() => onConfirm("occurrence")} style={optionButtonStyle}>
            Delete this occurrence only
          </button>
          <button
            type="button"
            onClick={() => onConfirm("series")}
            style={{ ...optionButtonStyle, color: "#c0392b", borderColor: "#f0b8b8" }}
          >
            Delete the whole series
          </button>
          <button type="button" onClick={onClose} style={{ ...optionButtonStyle, background: "none", border: "none", color: "#888780" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

const optionButtonStyle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 500,
  padding: "10px 14px",
  borderRadius: "8px",
  background: "white",
  color: "#111111",
  border: "0.5px solid #e1e0d9",
  cursor: "pointer",
  textAlign: "left",
};
