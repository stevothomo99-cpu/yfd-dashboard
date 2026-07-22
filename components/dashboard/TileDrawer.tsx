"use client";

import { useEffect, useState } from "react";
import StaffAvatar from "./StaffAvatar";
import { initialsOf } from "@/lib/utils";
import type { ClientSummary, CustomerFile, CustomerNote, TaskWithDetails } from "@/types/workflow";

interface Props {
  tile: ClientSummary | null;
  onClose: () => void;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function toneOf(t: TaskWithDetails, today: string): "overdue" | "normal" | "completed" {
  if (t.statusIsComplete) return "completed";
  if (t.dueDate && t.dueDate < today) return "overdue";
  return "normal";
}

function fmtBytes(bytes: number | null): string {
  if (bytes == null) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function TileDrawer({ tile, onClose }: Props) {
  const [tasks, setTasks] = useState<TaskWithDetails[]>([]);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [files, setFiles] = useState<CustomerFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tile) return;
    let cancelled = false;

    const fetchDetails = async () => {
      setLoading(true);
      setError(null);
      try {
        const [taskData, noteData, fileData] = await Promise.all([
          fetch(`/api/workflow/customers/${tile.id}/tasks`).then((r) => r.json()),
          fetch(`/api/workflow/customers/${tile.id}/notes`).then((r) => r.json()),
          fetch(`/api/workflow/customers/${tile.id}/files`).then((r) => r.json()),
        ]);
        if (cancelled) return;
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

  async function handleAddNote() {
    if (!tile || !noteText.trim()) return;
    setSubmittingNote(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/customers/${tile.id}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: noteText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save note");
      setNotes((prev) => [data.note, ...prev]);
      setNoteText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save note");
    } finally {
      setSubmittingNote(false);
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
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "white",
          height: "100%",
          overflow: "auto",
          padding: "1.5rem 1.5rem 3rem",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#111111" }}>{tile.name}</div>
            {tile.managerName ? (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "6px" }}>
                <StaffAvatar initials={initialsOf(tile.managerName)} size={22} />
                <span style={{ fontSize: "12px", color: "#444441" }}>{tile.managerName}</span>
              </div>
            ) : null}
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
            <Section title={`Overdue · ${overdue.length}`}>
              {overdue.length === 0 ? <Empty label="No overdue tasks." /> : <Stack>{overdue.map((t) => <WorkItemRow key={t.id} task={t} accent="#e24b4a" />)}</Stack>}
            </Section>

            <Section title={`In progress · ${inProgress.length}`}>
              {inProgress.length === 0 ? <Empty label="Nothing in progress." /> : <Stack>{inProgress.map((t) => <WorkItemRow key={t.id} task={t} accent="#2a78d6" />)}</Stack>}
            </Section>

            <Section title={`Completed · ${completed.length}`}>
              {completed.length === 0 ? <Empty label="No completed tasks yet." /> : <Stack>{completed.map((t) => <WorkItemRow key={t.id} task={t} accent="#1baf7a" />)}</Stack>}
            </Section>
          </>
        )}

        <Section title={`Notes · ${notes.length}`}>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
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
                <div key={n.id} style={{ background: "#fafaf8", borderRadius: "8px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "13px", color: "#111111", whiteSpace: "pre-wrap" }}>{n.body}</div>
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
                      {fmtBytes(f.sizeBytes)} · {f.uploadedByName ?? "Unknown"} · {new Date(f.createdAt).toLocaleDateString("en-AU")}
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
    </div>
  );
}

function WorkItemRow({ task, accent }: { task: TaskWithDetails; accent: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 12px", background: "#fafaf8", borderRadius: "8px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {task.title}
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>
          {task.jobName} · {task.assigneeName ?? "Unassigned"} · Due {task.dueDate ?? "—"}
        </div>
      </div>
      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: accent, marginLeft: "12px", flexShrink: 0 }} />
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
