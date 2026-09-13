"use client";

import { useEffect, useState } from "react";
import type { ClientSummary, CustomerNote } from "@/types/workflow";

interface Props {
  tile: ClientSummary | null;
  onClose: () => void;
}

// A narrower, notes-only sibling of TileDrawer -- opened from ClientTile's
// "Notes" shortcut so a quick note check/add doesn't require scrolling past
// Jobs/Overdue/In progress/Completed/Recurring first.
export default function NotesDrawer({ tile, onClose }: Props) {
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [loading, setLoading] = useState(false);
  const [noteTitle, setNoteTitle] = useState("");
  const [noteText, setNoteText] = useState("");
  const [submittingNote, setSubmittingNote] = useState(false);
  const [togglingPinId, setTogglingPinId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!tile) return;
    let cancelled = false;

    const fetchNotes = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await fetch(`/api/workflow/customers/${tile.id}/notes`).then((r) => r.json());
        if (!cancelled) setNotes(data.notes ?? []);
      } catch {
        if (!cancelled) setError("Failed to load notes.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchNotes();
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
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "400px",
          background: "white",
          height: "100%",
          overflow: "auto",
          padding: "1.5rem",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.06)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#111111" }}>{tile.name}</div>
            <div style={{ fontSize: "11px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginTop: "4px" }}>
              Notes
            </div>
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

        <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
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

        {loading ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "12px 0" }}>Loading…</div>
        ) : notes.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "4px 0" }}>No notes yet.</div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
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
          </div>
        )}
      </div>
    </div>
  );
}
