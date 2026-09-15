"use client";

import { useEffect, useMemo, useState } from "react";
import StaffAvatar from "./StaffAvatar";
import CopyTaskModal from "./CopyTaskModal";
import SaveTemplateModal from "./SaveTemplateModal";
import ApplyTemplateModal from "./ApplyTemplateModal";
import NewTaskModal from "./NewTaskModal";
import { formatDate, initialsOf } from "@/lib/utils";
import type {
  ClientSummary,
  CustomerFile,
  CustomerNote,
  JobWithManager,
  TaskWithDetails,
  WorkflowCustomer,
  WorkflowStaff,
  WorkflowStatus,
  WorkflowTaskType,
} from "@/types/workflow";

interface Props {
  tile: ClientSummary | null;
  onClose: () => void;
  // Every client (id/name only) -- feeds the destination-client picker in
  // the "Copy task" and "Apply template" modals. Passed down from
  // ClientsPageClient.tsx, which already loads the full tile list for its
  // own grid, rather than fetching a second copy here.
  allClients: { id: string; name: string }[];
  // Reference data for the task drill-down modal (My Work/BAS Status use
  // the same NewTaskModal, same shapes).
  staff: WorkflowStaff[];
  statuses: WorkflowStatus[];
  taskTypes: WorkflowTaskType[];
  clients: WorkflowCustomer[];
  // Admin-only "Reassign" control on the Manager row. A quick fix tool, not
  // synced back to XPM -- see setCustomerManager's comment in lib/workflow.ts.
  isAdmin?: boolean;
  onManagerChanged?: (customerId: string, managerId: string | null, managerName: string | null) => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toneOf(t: TaskWithDetails, today: string): "overdue" | "normal" | "completed" {
  if (t.statusIsComplete) return "completed";
  if (t.dueDate && t.dueDate < today) return "overdue";
  return "normal";
}

const RECURRENCE_LABEL: Record<TaskWithDetails["recurrence"], string> = {
  none: "One-off",
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

type SortColumn = "title" | "type" | "due";
interface SortState {
  col: SortColumn;
  dir: 1 | -1;
}

// Sorting by Title or Type alone leaves ties in whatever order the tasks
// happened to load in -- due date is the natural tiebreaker (soonest due
// first) so, e.g., every "Payroll" row still reads oldest-to-newest within
// its own group. Sorting by Due date itself has no secondary key.
function sortTasks(rows: TaskWithDetails[], state: SortState): TaskWithDetails[] {
  const { col, dir } = state;
  const key = (t: TaskWithDetails): string =>
    col === "title" ? t.title : col === "type" ? (t.typeName ?? "") : (t.dueDate ?? "");
  return [...rows].sort((a, b) => {
    const av = key(a);
    const bv = key(b);
    if (av < bv) return -1 * dir;
    if (av > bv) return 1 * dir;
    if (col !== "due") {
      const ad = a.dueDate ?? "";
      const bd = b.dueDate ?? "";
      if (ad < bd) return -1;
      if (ad > bd) return 1;
    }
    return 0;
  });
}

function fmtBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TileDrawer({
  tile,
  onClose,
  allClients,
  staff,
  statuses,
  taskTypes,
  clients,
  isAdmin,
  onManagerChanged,
}: Props) {
  const [jobs, setJobs] = useState<JobWithManager[]>([]);
  // Collapsed by default -- Jobs is rarely the reason anyone opens this
  // drawer (Overdue/In progress/Notes are), and a client with several years
  // of still-open XPM jobs (see the RECS Enterprises case) can otherwise
  // push everything else below the fold.
  const [jobsExpanded, setJobsExpanded] = useState(false);
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [reassigning, setReassigning] = useState(false);
  const [savingManager, setSavingManager] = useState(false);
  const [managerError, setManagerError] = useState<string | null>(null);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copyingTask, setCopyingTask] = useState<TaskWithDetails | null>(null);
  const [editingTask, setEditingTask] = useState<TaskWithDetails | null>(null);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const [showApplyTemplate, setShowApplyTemplate] = useState(false);
  const [showNewTask, setShowNewTask] = useState(false);
  // Completed/Recurring collapse the same way Jobs already does -- a client
  // with a long history otherwise pushes Notes/Files off the bottom of the
  // drawer for no reason once Overdue/In progress are the reason it's open.
  const [completedExpanded, setCompletedExpanded] = useState(false);
  const [recurringExpanded, setRecurringExpanded] = useState(false);
  const [sortState, setSortState] = useState<Record<"overdue" | "progress", SortState>>({
    overdue: { col: "due", dir: 1 },
    progress: { col: "due", dir: 1 },
  });
  // Read-only drill-down for the Overdue/In progress tables -- deliberately
  // NOT the full NewTaskModal editor: a set task's title/type/due date
  // shouldn't be changed from a quick table click, only its completion
  // state (see the "Mark complete" button below).
  const [viewingTask, setViewingTask] = useState<TaskWithDetails | null>(null);
  const [completingTaskId, setCompletingTaskId] = useState<string | null>(null);
  const completedStatusId = useMemo(() => statuses.find((s) => s.isComplete)?.id ?? null, [statuses]);

  async function refreshTasks() {
    if (!tile) return;
    const data = await fetch(`/api/workflow/customers/${tile.id}/tasks`).then((r) => r.json());
    setTasks(data.tasks ?? []);
  }

  // Same PATCH-the-status pattern as the BAS Status board's own "Mark
  // complete" -- see BasStatusPageClient.tsx's completeTask.
  async function completeTask(taskId: string) {
    if (!completedStatusId) {
      setError("No status is configured as complete -- check Settings.");
      return;
    }
    setCompletingTaskId(taskId);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/tasks/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statusId: completedStatusId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to complete task");
        return;
      }
      await refreshTasks();
      setViewingTask(null);
    } catch {
      setError("Failed to complete task");
    } finally {
      setCompletingTaskId(null);
    }
  }

  async function handleReassign(newManagerId: string) {
    if (!tile) return;
    setSavingManager(true);
    setManagerError(null);
    try {
      const managerId = newManagerId || null;
      const res = await fetch(`/api/workflow/customers/${tile.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ managerId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to reassign client");
      const managerName = managerId ? staff.find((s) => s.id === managerId)?.name ?? null : null;
      onManagerChanged?.(tile.id, managerId, managerName);
      setReassigning(false);
    } catch (err) {
      setManagerError(err instanceof Error ? err.message : "Failed to reassign client");
    } finally {
      setSavingManager(false);
    }
  }

  useEffect(() => {
    if (!tile) return;
    let cancelled = false;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      setReassigning(false);
      setManagerError(null);
      try {
        const [jobData, taskData, noteData, fileData] = await Promise.all([
          fetch(`/api/workflow/customers/${tile.id}/jobs`).then((r) => r.json()),
          fetch(`/api/workflow/customers/${tile.id}/tasks`).then((r) => r.json()),
          fetch(`/api/workflow/customers/${tile.id}/notes`).then((r) => r.json()),
          fetch(`/api/workflow/customers/${tile.id}/files`).then((r) => r.json()),
        ]);
        if (cancelled) return;
        setJobs(jobData.jobs ?? []);
        setTasks(taskData.tasks ?? []);
        setNotes(noteData.notes ?? []);
        setFiles(fileData.files ?? []);
      } catch {
        if (!cancelled) setError("Failed to load client details.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchDetails();
    return () => {
      cancelled = true;
    };
  }, [tile]);

  useEffect(() => {
    if (!tile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tile, onClose]);

  if (!tile) return null;

  const today = todayIso();
  const overdue = tasks.filter((t) => toneOf(t, today) === "overdue");
  const inProgress = tasks.filter((t) => toneOf(t, today) === "normal");
  const completed = tasks.filter((t) => toneOf(t, today) === "completed");
  // A cross-cutting view, not a status bucket -- what's currently set to
  // recur against this client at all, regardless of where any one
  // occurrence sits in Overdue/In progress/Completed above.
  const recurring = tasks.filter((t) => t.recurrence !== "none");

  async function handleAddNote() {
    if (!tile || !noteText.trim()) return;
    setSubmittingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/customers/${tile.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: noteTitle.trim() || undefined, body: noteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save note");
      // New notes are never pinned, so they always land after any existing
      // pinned ones -- appending, not prepending, keeps that order without
      // needing a full re-fetch/re-sort.
      setNotes((prev) => [...prev.filter((n) => n.pinned), data.note, ...prev.filter((n) => !n.pinned)]);
      setNoteTitle("");
      setNoteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmittingNote(false);
    }
  }

  async function handleTogglePin(note: CustomerNote) {
    setTogglingPinId(note.id);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/notes/${note.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update note");
      setNotes((prev) => {
        const updated = prev.map((n) => (n.id === note.id ? (data.note as CustomerNote) : n));
        const pinned = updated.filter((n) => n.pinned);
        const rest = updated.filter((n) => !n.pinned);
        return [...pinned, ...rest];
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update note");
    } finally {
      setTogglingPinId(null);
    }
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!tile || !file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch(`/api/workflow/customers/${tile.id}/files`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to upload file");
      setFiles((prev) => [data.file, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setUploading(false);
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
        justifyContent: "flex-end",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "760px",
          background: "white",
          height: "100%",
          overflow: "auto",
          padding: "1.5rem 1.5rem 3rem",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#111111" }}>{tile.name}</div>
            {reassigning ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", marginTop: "6px" }}>
                <select
                  autoFocus
                  defaultValue={tile.managerIds[0] ?? ""}
                  onChange={(e) => handleReassign(e.target.value)}
                  disabled={savingManager}
                  style={{
                    fontSize: "12px",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    border: "0.5px solid #e1e0d9",
                    background: "white",
                    color: "#111111",
                  }}
                >
                  <option value="">— No manager —</option>
                  {staff.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {savingManager ? <span style={{ fontSize: "11px", color: "#888780" }}>Saving…</span> : null}
                  <button
                    type="button"
                    onClick={() => {
                      setReassigning(false);
                      setManagerError(null);
                    }}
                    style={{ fontSize: "11px", color: "#888780", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    Cancel
                  </button>
                </div>
                {managerError ? <div style={{ fontSize: "11px", color: "#c0392b" }}>{managerError}</div> : null}
              </div>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                {tile.managerName ? (
                  <>
                    <StaffAvatar initials={initialsOf(tile.managerName)} size={22} />
                    <span style={{ fontSize: "12px", color: "#444441" }}>{tile.managerName}</span>
                  </>
                ) : (
                  <span style={{ fontSize: "12px", color: "#888780" }}>No manager assigned</span>
                )}
                {isAdmin ? (
                  <button
                    type="button"
                    onClick={() => setReassigning(true)}
                    style={{ fontSize: "11px", color: "#2a78d6", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    Reassign
                  </button>
                ) : null}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: "transparent", border: "none", fontSize: "22px", color: "#888780", cursor: "pointer", lineHeight: 1, padding: "4px 8px" }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {error ? (
          <div style={{ fontSize: "12px", color: "#501313", background: "#FCEBEB", border: "0.5px solid #f0b8b8", borderRadius: "10px", padding: "8px 12px", marginBottom: "16px" }}>
            {error}
          </div>
        ) : null}

        {loading ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "12px 0" }}>Loading…</div>
        ) : (
          <>
            <div style={{ marginBottom: "20px" }}>
              <button
                type="button"
                onClick={() => setJobsExpanded((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "none",
                  border: "none",
                  padding: 0,
                  marginBottom: jobsExpanded ? "10px" : 0,
                  cursor: "pointer",
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "#888780",
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                }}
              >
                <span>{jobsExpanded ? "▾" : "▸"}</span>
                <span>Jobs · {jobs.length}</span>
              </button>
              {jobsExpanded ? (
                jobs.length === 0 ? (
                  <Empty label="No jobs on this client yet." />
                ) : (
                  <Stack>
                    {jobs.map((j) => (
                      <div
                        key={j.id}
                        style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafaf8", borderRadius: "8px", padding: "10px 12px" }}
                      >
                        <span style={{ fontSize: "13px", color: "#111111" }}>{j.name}</span>
                        <span style={{ fontSize: "12px", color: "#888780" }}>{j.managerName ?? "Unassigned"}</span>
                      </div>
                    ))}
                  </Stack>
                )
              ) : null}
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <button type="button" onClick={() => setShowNewTask(true)} style={ghostButtonStyle}>
                Add task
              </button>
              <button type="button" onClick={() => setShowSaveTemplate(true)} style={ghostButtonStyle}>
                Save tasks as template
              </button>
              <button type="button" onClick={() => setShowApplyTemplate(true)} style={ghostButtonStyle}>
                Apply template
              </button>
            </div>

            <Section title={`Overdue · ${overdue.length}`}>
              {overdue.length === 0 ? (
                <Empty label="No overdue tasks." />
              ) : (
                <TaskTable
                  tasks={overdue}
                  accent="#e24b4a"
                  sort={sortState.overdue}
                  onSort={(col) =>
                    setSortState((prev) => ({
                      ...prev,
                      overdue: { col, dir: prev.overdue.col === col ? ((prev.overdue.dir * -1) as 1 | -1) : 1 },
                    }))
                  }
                  onCopy={setCopyingTask}
                  onOpen={setViewingTask}
                />
              )}
            </Section>

            <Section title={`In progress · ${inProgress.length}`}>
              {inProgress.length === 0 ? (
                <Empty label="Nothing in progress." />
              ) : (
                <TaskTable
                  tasks={inProgress}
                  accent="#2a78d6"
                  sort={sortState.progress}
                  onSort={(col) =>
                    setSortState((prev) => ({
                      ...prev,
                      progress: { col, dir: prev.progress.col === col ? ((prev.progress.dir * -1) as 1 | -1) : 1 },
                    }))
                  }
                  onCopy={setCopyingTask}
                  onOpen={setViewingTask}
                />
              )}
            </Section>

            <ConcertinaSection
              label="Completed"
              count={completed.length}
              expanded={completedExpanded}
              onToggle={() => setCompletedExpanded((v) => !v)}
            >
              {completed.length === 0 ? (
                <Empty label="No completed tasks yet." />
              ) : (
                <Stack>{completed.map((t) => <WorkItemRow key={t.id} task={t} accent="#1baf7a" onCopy={setCopyingTask} onOpen={setEditingTask} />)}</Stack>
              )}
            </ConcertinaSection>

            <ConcertinaSection
              label="Recurring"
              count={recurring.length}
              expanded={recurringExpanded}
              onToggle={() => setRecurringExpanded((v) => !v)}
            >
              {recurring.length === 0 ? (
                <Empty label="Nothing set to recur on this client." />
              ) : (
                <Stack>
                  {recurring.map((t) => (
                    <WorkItemRow key={t.id} task={t} accent="#8a5ea8" onCopy={setCopyingTask} onOpen={setEditingTask} showRecurrence />
                  ))}
                </Stack>
              )}
            </ConcertinaSection>
          </>
        )}

        <Section title={`Notes · ${notes.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            <input
              type="text"
              value={noteTitle}
              onChange={(e) => setNoteTitle(e.target.value)}
              placeholder="Title (optional)…"
              style={{
                fontSize: "13px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "0.5px solid #e1e0d9",
                outline: "none",
                fontFamily: "inherit",
              }}
            />
            <textarea
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note about this client…"
              rows={3}
              style={{
                fontSize: "13px",
                padding: "8px 10px",
                borderRadius: "8px",
                border: "0.5px solid #e1e0d9",
                outline: "none",
                resize: "vertical",
                fontFamily: "inherit",
              }}
            />
            <button
              type="button"
              onClick={handleAddNote}
              disabled={submittingNote || !noteText.trim()}
              style={{
                alignSelf: "flex-end",
                fontSize: "12px",
                fontWeight: 500,
                padding: "6px 14px",
                borderRadius: "999px",
                background: "#111111",
                color: "white",
                border: "none",
                cursor: submittingNote ? "default" : "pointer",
                opacity: submittingNote || !noteText.trim() ? 0.6 : 1,
              }}
            >
              {submittingNote ? "Saving…" : "Add note"}
            </button>
          </div>

          {notes.length === 0 ? (
            <Empty label="No notes yet." />
          ) : (
            <Stack>
              {notes.map((n) => (
                <div
                  key={n.id}
                  style={{
                    background: n.pinned ? "#fdf6e3" : "#fafaf8",
                    border: n.pinned ? "0.5px solid #eda100" : "0.5px solid transparent",
                    borderRadius: "8px",
                    padding: "10px 12px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      {n.title ? (
                        <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111", marginBottom: "2px" }}>
                          {n.title}
                        </div>
                      ) : null}
                      <div style={{ fontSize: "13px", color: "#111111", whiteSpace: "pre-wrap" }}>{n.body}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleTogglePin(n)}
                      disabled={togglingPinId === n.id}
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        color: n.pinned ? "#a8710a" : "#888780",
                        background: n.pinned ? "#faecc8" : "transparent",
                        border: "none",
                        borderRadius: "6px",
                        cursor: togglingPinId === n.id ? "default" : "pointer",
                        padding: "3px 8px",
                        flexShrink: 0,
                        opacity: togglingPinId === n.id ? 0.6 : 1,
                      }}
                    >
                      {n.pinned ? "Pinned" : "Pin"}
                    </button>
                  </div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: "6px" }}>
                    {n.authorName} · {new Date(n.createdAt).toLocaleString("en-AU")}
                  </div>
                </div>
              ))}
            </Stack>
          )}
        </Section>

        <Section title={`Files · ${files.length}`}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              fontSize: "12px",
              fontWeight: 500,
              padding: "6px 14px",
              borderRadius: "999px",
              background: "white",
              color: "#444441",
              border: "0.5px solid #e1e0d9",
              cursor: uploading ? "default" : "pointer",
              marginBottom: "12px",
              opacity: uploading ? 0.6 : 1,
            }}
          >
            {uploading ? "Uploading…" : "+ Upload file"}
            <input type="file" onChange={handleUpload} disabled={uploading} style={{ display: "none" }} />
          </label>

          {files.length === 0 ? (
            <Empty label="No files yet." />
          ) : (
            <Stack>
              {files.map((f) => (
                <div key={f.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#fafaf8", borderRadius: "8px", padding: "10px 12px" }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: "13px", color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.fileName}</div>
                    <div style={{ fontSize: "11px", color: "#888780", marginTop: "4px" }}>
                      {fmtBytes(f.sizeBytes)} · {f.uploadedByName ?? "Unknown"} · {formatDate(f.createdAt)}
                    </div>
                  </div>
                  {f.downloadUrl ? (
                    <a href={f.downloadUrl} target="_blank" rel="noreferrer" style={{ fontSize: "12px", color: "#2a78d6", fontWeight: 500, flexShrink: 0, marginLeft: "12px" }}>
                      Download
                    </a>
                  ) : null}
                </div>
              ))}
            </Stack>
          )}
        </Section>
      </div>

      {viewingTask ? (
        <TaskDetailModal
          task={viewingTask}
          onClose={() => setViewingTask(null)}
          onComplete={() => completeTask(viewingTask.id)}
          completing={completingTaskId === viewingTask.id}
        />
      ) : null}

      {copyingTask ? (
        <CopyTaskModal
          task={copyingTask}
          clients={allClients}
          onClose={() => setCopyingTask(null)}
          onCopied={refreshTasks}
        />
      ) : null}

      {editingTask ? (
        <NewTaskModal
          onClose={() => setEditingTask(null)}
          onCreated={refreshTasks}
          onDeleted={refreshTasks}
          clients={clients}
          staff={staff}
          statuses={statuses}
          taskTypes={taskTypes}
          editTask={editingTask}
        />
      ) : null}

      {showNewTask && tile ? (
        <NewTaskModal
          onClose={() => setShowNewTask(false)}
          onCreated={refreshTasks}
          clients={clients}
          staff={staff}
          statuses={statuses}
          taskTypes={taskTypes}
          defaultClientId={tile.id}
        />
      ) : null}

      {showSaveTemplate ? (
        <SaveTemplateModal
          customerName={tile.name}
          tasks={tasks}
          onClose={() => setShowSaveTemplate(false)}
          onSaved={() => {}}
        />
      ) : null}

      {showApplyTemplate ? (
        <ApplyTemplateModal
          clients={allClients}
          initialClientId={tile.id}
          onClose={() => setShowApplyTemplate(false)}
          onApplied={refreshTasks}
        />
      ) : null}
    </div>
  );
}

function WorkItemRow({
  task,
  accent,
  onCopy,
  onOpen,
  showRecurrence,
}: {
  task: TaskWithDetails;
  accent: string;
  onCopy: (task: TaskWithDetails) => void;
  onOpen: (task: TaskWithDetails) => void;
  // Recurring is a cross-cutting list, not a status bucket -- the frequency
  // is the useful thing to see there, in place of the due date every other
  // section already shows (a recurring task's due date is just whichever
  // occurrence happens to be open right now, not the interesting fact).
  showRecurrence?: boolean;
}) {
  return (
    <div
      onClick={() => onOpen(task)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen(task);
      }}
      style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#fafaf8", borderRadius: "8px", cursor: "pointer" }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>
          {task.typeName ? `${task.typeName} · ` : ""}
          {task.assigneeName ?? "Unassigned"}
          {showRecurrence
            ? ` · ${RECURRENCE_LABEL[task.recurrence]}`
            : ` · Due ${formatDate(task.dueDate)}`}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onCopy(task);
        }}
        style={{ fontSize: "11px", color: "#888780", background: "none", border: "none", cursor: "pointer", padding: "2px 6px", flexShrink: 0, marginLeft: "8px" }}
      >
        Copy…
      </button>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: accent, marginLeft: "8px", flexShrink: 0 }} />
    </div>
  );
}

const SORT_COLUMNS: { col: SortColumn; label: string }[] = [
  { col: "title", label: "Title" },
  { col: "type", label: "Type" },
  { col: "due", label: "Due date" },
];

// Overdue/In progress are sortable tables (click a header to sort by it,
// click again to reverse) rather than the card list Completed/Recurring
// still use -- the two sections that grow the largest and get scanned by
// due date/type most often, e.g. clients like RECS Enterprises with a
// dozen+ open tasks. Clicking a row opens a read-only detail popup; the
// separate Copy button next to it stays its own action either way.
function TaskTable({
  tasks,
  accent,
  sort,
  onSort,
  onCopy,
  onOpen,
}: {
  tasks: TaskWithDetails[];
  accent: string;
  sort: SortState;
  onSort: (col: SortColumn) => void;
  onCopy: (task: TaskWithDetails) => void;
  onOpen: (task: TaskWithDetails) => void;
}) {
  const sorted = sortTasks(tasks, sort);
  return (
    <div style={{ border: "0.5px solid #e1e0d9", borderRadius: "10px", overflow: "hidden" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr>
            {SORT_COLUMNS.map(({ col, label }) => (
              <th key={col} style={{ textAlign: "left", padding: "8px 12px", background: "#fafaf8", borderBottom: "0.5px solid #e1e0d9" }}>
                <button
                  type="button"
                  onClick={() => onSort(col)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    fontSize: "10.5px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: sort.col === col ? "#2a78d6" : "#888780",
                  }}
                >
                  {label}
                  <span style={{ fontSize: "9px", visibility: sort.col === col ? "visible" : "hidden" }}>
                    {sort.dir === 1 ? "▲" : "▼"}
                  </span>
                </button>
              </th>
            ))}
            <th style={{ background: "#fafaf8", borderBottom: "0.5px solid #e1e0d9" }} />
          </tr>
        </thead>
        <tbody>
          {sorted.map((t) => (
            <tr
              key={t.id}
              onClick={() => onOpen(t)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") onOpen(t);
              }}
              style={{ cursor: "pointer", borderBottom: "0.5px solid #e1e0d9" }}
            >
              <td style={{ padding: "8px 12px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 500, color: "#111111" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: accent, flexShrink: 0 }} />
                  {t.title}
                </span>
              </td>
              <td style={{ padding: "8px 12px", color: "#888780" }}>{t.typeName ?? "—"}</td>
              <td style={{ padding: "8px 12px", color: "#888780", whiteSpace: "nowrap" }}>{formatDate(t.dueDate)}</td>
              <td style={{ padding: "8px 12px", textAlign: "right" }}>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCopy(t);
                  }}
                  style={{ fontSize: "11px", color: "#888780", background: "none", border: "none", cursor: "pointer", padding: "2px 6px" }}
                >
                  Copy…
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Read-only drill-down opened by clicking an Overdue/In progress row -- a
// set task's title/type/due date is deliberately not editable from here
// (that's still the full NewTaskModal, reached via Completed/Recurring's
// WorkItemRow or elsewhere); the only action is marking it done.
function TaskDetailModal({
  task,
  onClose,
  onComplete,
  completing,
}: {
  task: TaskWithDetails;
  onClose: () => void;
  onComplete: () => void;
  completing: boolean;
}) {
  return (
    <div
      style={{ position: "fixed", inset: 0, background: "rgba(17, 17, 17, 0.35)", zIndex: 200, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ width: "380px", maxWidth: "100%", background: "white", borderRadius: "12px", padding: "20px", boxShadow: "0 24px 60px rgba(17,17,17,0.25)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>{task.title}</div>
          <button type="button" onClick={onClose} aria-label="Close" style={{ background: "none", border: "none", fontSize: "18px", color: "#888780", cursor: "pointer", padding: "2px 6px", lineHeight: 1 }}>
            ×
          </button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
          <Field label="Type" value={task.typeName ?? "—"} />
          <Field label="Due date" value={formatDate(task.dueDate)} />
        </div>
        <Field label="Assignee" value={task.assigneeName ?? "Unassigned"} />
        <div style={{ display: "flex", gap: "8px", marginTop: "18px" }}>
          <button type="button" disabled={completing} onClick={onComplete} style={completeButtonStyle}>
            {completing ? "Marking complete…" : "Mark complete"}
          </button>
          <button type="button" onClick={onClose} style={{ ...ghostButtonStyle, borderRadius: "8px" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ marginBottom: "8px" }}>
      <div style={{ fontSize: "10.5px", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em", color: "#888780", marginBottom: "3px" }}>
        {label}
      </div>
      <div style={{ fontSize: "13px", color: "#111111" }}>{value}</div>
    </div>
  );
}

function ConcertinaSection({
  label,
  count,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "6px",
          background: "none",
          border: "none",
          padding: 0,
          marginBottom: expanded ? "10px" : 0,
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
        }}
      >
        <span>{expanded ? "▾" : "▸"}</span>
        <span>{label} · {count}</span>
      </button>
      {expanded ? children : null}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div style={{ fontSize: "11px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "10px" }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{children}</div>;
}

function Empty({ label }: { label: string }) {
  return <div style={{ fontSize: "12px", color: "#888780", padding: "4px 0" }}>{label}</div>;
}

const ghostButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "6px 14px",
  borderRadius: "999px",
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
  cursor: "pointer",
};

// Same dark-filled convention as the BAS Status board's own "Mark complete"
// (see BasStatusPageClient.tsx's completeButtonStyle) -- a status badge that
// looked done was confusing there, so this drawer's version never repeats
// that green-checkmark mistake either.
const completeButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  padding: "7px 14px",
  borderRadius: "8px",
  border: "0.5px solid #111111",
  background: "#111111",
  color: "white",
  cursor: "pointer",
};
