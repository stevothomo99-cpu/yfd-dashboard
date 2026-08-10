"use client";

import { useEffect, useMemo, useState } from "react";
import { formatDate } from "@/lib/utils";
import type {
  CustomerFile,
  CustomerNote,
  RecurrenceInterval,
  TaskWithDetails,
  WorkflowCustomer,
  WorkflowStaff,
  WorkflowStatus,
  WorkflowTaskType,
} from "@/types/workflow";

interface NewTaskModalProps {
  onClose: () => void;
  onCreated: () => void;
  clients: WorkflowCustomer[];
  staff: WorkflowStaff[];
  statuses: WorkflowStatus[];
  taskTypes: WorkflowTaskType[];
  // When set, the modal edits this task (PATCH) instead of creating a new
  // one (POST) -- same form, same fields, just a different submit target
  // and starting values. clients/staff are still expected to already be
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

function formatCompletedAt(iso: string): string {
  const time = new Date(iso).toLocaleTimeString("en-AU", { hour: "numeric", minute: "2-digit" });
  return `${formatDate(iso)} ${time}`;
}

// Mounted/unmounted by the parent (only rendered while the modal is open),
// so a fresh instance -- and fresh initial state below -- is all it takes to
// reset the form each time it's opened; no reset-on-open effect needed.
export default function NewTaskModal({ onClose, onCreated, clients, staff, statuses, taskTypes, editTask }: NewTaskModalProps) {
  const isEdit = Boolean(editTask);

  // If the task being edited is on a client outside the (already-scoped)
  // clients list passed in -- shouldn't normally happen since canModifyTask
  // and getClientsInScopeForStaff walk the same hierarchy, but defend
  // against it anyway -- make sure its current client still shows up as a
  // selectable option rather than silently rendering a blank/invalid select.
  const clientsWithCurrent = useMemo(
    () =>
      editTask && !clients.some((c) => c.id === editTask.customerId)
        ? [...clients, { id: editTask.customerId, xpmClientId: null, name: editTask.customerName, partnerId: null } satisfies WorkflowCustomer]
        : clients,
    [clients, editTask],
  );

  const sortedClients = useMemo(
    () => [...clientsWithCurrent].sort((a, b) => a.name.localeCompare(b.name)),
    [clientsWithCurrent],
  );

  const [clientId, setClientId] = useState(editTask?.customerId ?? "");
  const [title, setTitle] = useState(editTask?.title ?? "");
  const [typeId, setTypeId] = useState(editTask?.typeId ?? "");
  const [statusId, setStatusId] = useState(() => editTask?.statusId ?? defaultStatusId(statuses));
  const [assigneeId, setAssigneeId] = useState(editTask?.assigneeId ?? "");
  const [dueDate, setDueDate] = useState(editTask?.dueDate ?? "");
  const [startDate, setStartDate] = useState(editTask?.startDate ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceInterval>(editTask?.recurrence ?? "none");
  const [details, setDetails] = useState(editTask?.details ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read-only reference list of the selected client's existing notes/files
  // (see app/api/workflow/customers/[id]/notes and .../files, the same
  // endpoints TileDrawer.tsx already uses on the Clients page) -- there's
  // no per-task note/file relationship in the schema, so this is just
  // context, refetched whenever the chosen client changes.
  const [clientNotes, setClientNotes] = useState<CustomerNote[]>([]);
  const [clientFiles, setClientFiles] = useState<CustomerFile[]>([]);
  const [loadingClientRefs, setLoadingClientRefs] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    if (!clientId) {
      setClientNotes([]);
      setClientFiles([]);
      return;
    }
    let cancelled = false;
    setLoadingClientRefs(true);
    Promise.all([
      fetch(`/api/workflow/customers/${clientId}/notes`).then((r) => r.json()),
      fetch(`/api/workflow/customers/${clientId}/files`).then((r) => r.json()),
    ])
      .then(([noteData, fileData]) => {
        if (cancelled) return;
        setClientNotes(noteData.notes ?? []);
        setClientFiles(fileData.files ?? []);
      })
      .catch(() => {
        if (!cancelled) {
          setClientNotes([]);
          setClientFiles([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoadingClientRefs(false);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !title.trim() || !statusId) {
      setError("Client, title, and status are required.");
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
          customerId: clientId,
          title: title.trim(),
          statusId,
          typeId: typeId || null,
          assigneeId: assigneeId || null,
          dueDate: dueDate || null,
          startDate: startDate || null,
          recurrence,
          details: details.trim() || null,
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
          <Field label="Client" required>
            <select value={clientId} onChange={(e) => setClientId(e.target.value)} required style={inputStyle}>
              <option value="" disabled>
                Select a client…
              </option>
              {sortedClients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            {editTask?.karbonClientName ? (
              <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                Karbon: {editTask.karbonClientName}
              </div>
            ) : null}
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

          {/* A small audit note, not a full history log -- who completed
              this task and when, cleared again if it's reopened (see
              lib/workflow.ts's updateTask). */}
          {editTask?.completedAt ? (
            <div style={{ fontSize: "11px", color: "#888780", marginTop: "-4px" }}>
              Completed {formatCompletedAt(editTask.completedAt)}
              {editTask.completedByName ? ` by ${editTask.completedByName}` : ""}
            </div>
          ) : null}

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

          <Field label="Details">
            <textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="Notes or context for this task…"
              rows={3}
              style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
            />
          </Field>

          {clientId ? (
            <ClientReferenceSection notes={clientNotes} files={clientFiles} loading={loadingClientRefs} />
          ) : null}

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

function fmtBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Read-only reference list of the selected client's existing notes/files --
// the same data and download links shown in the Clients page drawer (see
// TileDrawer.tsx), just compacted for this modal. There's no per-task
// note/file relationship in the schema; this is context only, not a way to
// attach a file to this task specifically.
function ClientReferenceSection({
  notes,
  files,
  loading,
}: {
  notes: CustomerNote[];
  files: CustomerFile[];
  loading: boolean;
}) {
  return (
    <div>
      <div style={{ fontSize: "11px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.03em", marginBottom: "6px" }}>
        Client notes & files
      </div>
      {loading ? (
        <div style={{ fontSize: "12px", color: "#888780" }}>Loading…</div>
      ) : notes.length === 0 && files.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#888780" }}>Nothing on file for this client yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "160px", overflow: "auto" }}>
          {notes.map((n) => (
            <div key={`note-${n.id}`} style={{ background: "#fafaf8", borderRadius: "8px", padding: "8px 10px" }}>
              {n.title ? (
                <div style={{ fontSize: "12px", fontWeight: 600, color: "#111111" }}>{n.title}</div>
              ) : null}
              <div
                style={{
                  fontSize: "12px",
                  color: "#444441",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {n.body}
              </div>
            </div>
          ))}
          {files.map((f) => (
            <div
              key={`file-${f.id}`}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafaf8", borderRadius: "8px", padding: "8px 10px" }}
            >
              <span style={{ fontSize: "12px", color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {f.fileName}
                {f.sizeBytes != null ? ` · ${fmtBytes(f.sizeBytes)}` : ""}
              </span>
              {f.downloadUrl ? (
                <a
                  href={f.downloadUrl}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: "11px", color: "#2a78d6", fontWeight: 500, flexShrink: 0, marginLeft: "8px" }}
                >
                  Open
                </a>
              ) : null}
            </div>
          ))}
        </div>
      )}
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
