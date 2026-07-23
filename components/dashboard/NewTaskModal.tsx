"use client";

import { useEffect, useState } from "react";
import type {
  JobWithCustomer,
  RecurrenceInterval,
  TaskWithDetails,
  WorkflowStaff,
  WorkflowStatus,
  WorkflowTaskType,
} from "@/types/workflow";

interface NewTaskModalProps {
  onClose: () => void;
  onCreated: () => void;
  jobs: JobWithCustomer[];
  staff: WorkflowStaff[];
  statuses: WorkflowStatus[];
  taskTypes: WorkflowTaskType[];
  // When set, the modal edits this task (PATCH) instead of creating a new
  // one (POST) -- same form, same fields, just a different submit target
  // and starting values. jobs/staff are still expected to already be
  // pre-scoped by the caller (the server-side permission check is the real
  // boundary either way).
  editTask?: TaskWithDetails;
}

const RECURRENCE_OPTIONS: { value: RecurrenceInterval; label: string }[] = [
  { value: "none", label: "One-off" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

function defaultStatusId(statuses: WorkflowStatus[]): string {
  const openStatus = [...statuses].sort((a, b) => a.sortOrder - b.sortOrder).find((s) => !s.isComplete);
  return openStatus?.id ?? statuses[0]?.id ?? "";
}

// Mounted/unmounted by the parent (only rendered while the modal is open),
// so a fresh instance -- and fresh initial state below -- is all it takes to
// reset the form each time it's opened; no reset-on-open effect needed.
export default function NewTaskModal({ onClose, onCreated, jobs, staff, statuses, taskTypes, editTask }: NewTaskModalProps) {
  const isEdit = Boolean(editTask);
  const [jobId, setJobId] = useState(editTask?.jobId ?? "");
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [typeId, setTypeId] = useState(editTask?.typeId ?? "");
  const [statusId, setStatusId] = useState(() => editTask?.statusId ?? defaultStatusId(statuses));
  const [assigneeId, setAssigneeId] = useState(editTask?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(editTask?.dueDate ?? "");
  const [startDate, setStartDate] = useState(editTask?.startDate ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>(editTask?.recurrence ?? "none");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // If the task being edited is on a job outside the (already-scoped) jobs
  // list passed in -- shouldn't normally happen since canModifyTask and
  // getJobsInScopeForStaff walk the same hierarchy, but defend against it
  // anyway -- make sure its current job still shows up as a selectable
  // option rather than silently rendering a blank/invalid select.
  const jobsWithCurrent =
    editTask && !jobs.some((j) => j.id === editTask.jobId)
      ? [
          ...jobs,
          {
            id: editTask.jobId,
            customerId: "",
            xpmJobId: null,
            name: editTask.jobName,
            partnerId: null,
            managerId: null,
            customerName: editTask.customerName,
          } satisfies JobWithCustomer,
        ]
      : jobs;

  const sortedJobs = [...jobsWithCurrent].sort(
    (a, b) => a.customerName.localeCompare(b.customerName) || a.name.localeCompare(b.name)
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!jobId || !title.trim() || !statusId) {
      setError("Job, title, and status are required.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const url = isEdit ? `/api/workflow/tasks/${editTask!.id}` : "/api/workflow/tasks";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobId,
          title: title.trim(),
          statusId,
          typeId: typeId || null,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          startDate: startDate || null,
          recurrence,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to ${isEdit ? "save" : "create"} task`);
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${isEdit ? "save" : "create"} task`);
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
        zIndex: 100,
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
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>{isEdit ? "Edit Task" : "New Task"}</div>
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
          <Field label="Job" required>
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} required style={inputStyle}>
              <option value="" disabled>
                Select a job…
              </option>
              {sortedJobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.customerName} — {j.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Title" required>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              placeholder="Task title"
              style={inputStyle}
            />
          </Field>

          <div style={{ display: "flex", gap: "12px" }}>
            <Field label="Category" style={{ flex: 1 }}>
              <select value={typeId} onChange={(e) => setTypeId(e.target.value)} style={inputStyle}>
                <option value="">None</option>
                {taskTypes.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>

            <Field label="Status" required style={{ flex: 1 }}>
              <select value={statusId} onChange={(e) => setStatusId(e.target.value)} required style={inputStyle}>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Assignee">
            <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} style={inputStyle}>
              <option value="">Unassigned</option>
              {staff.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: "flex", gap: "12px" }}>
            <Field label="Start date" style={{ flex: 1 }}>
              <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
            </Field>
            <Field label="Due date" style={{ flex: 1 }}>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} style={inputStyle} />
            </Field>
          </div>

          <Field label="Recurrence">
            <select
              value={recurrence}
              onChange={(e) => setRecurrence(e.target.value as RecurrenceInterval)}
              style={inputStyle}
            >
              {RECURRENCE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </Field>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button type="submit" disabled={submitting} style={{ ...primaryButtonStyle, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? (isEdit ? "Saving…" : "Creating…") : isEdit ? "Save changes" : "Create task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  style,
  children,
}: {
  label: string;
  required?: boolean;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: "6px", ...style }}>
      <span style={{ fontSize: "11px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.03em" }}>
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
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
