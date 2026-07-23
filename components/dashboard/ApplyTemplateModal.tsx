"use client";

import { useEffect, useState } from "react";
import ClientJobPicker from "./ClientJobPicker";
import type { TaskTemplateSummary } from "@/types/workflow";

interface ClientOption {
  id: string;
  name: string;
}

interface ApplyTemplateModalProps {
  clients: ClientOption[];
  initialClientId?: string;
  onClose: () => void;
  onApplied: () => void;
}

// Picks a saved template and a destination client/job, then bulk-creates
// fresh, unscheduled, unassigned tasks on that job from the template's
// items -- see lib/workflow.ts's applyTemplateToJob.
export default function ApplyTemplateModal({ clients, initialClientId, onClose, onApplied }: ApplyTemplateModalProps) {
  const [templates, setTemplates] = useState<TaskTemplateSummary[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [templateId, setTemplateId] = useState("");
  const [clientId, setClientId] = useState(initialClientId ?? "");
  const [jobId, setJobId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/workflow/templates")
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setTemplates(data.templates ?? []);
      })
      .finally(() => {
        if (!cancelled) setLoadingTemplates(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!templateId) {
      setError("Choose a template.");
      return;
    }
    if (!jobId) {
      setError("Choose a destination job.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/workflow/templates/${templateId}/apply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jobId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to apply template");
      onApplied();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to apply template");
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
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "18px" }}>
          <div style={{ fontSize: "16px", fontWeight: 600, color: "#111111" }}>Apply template</div>
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

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <span style={labelStyle}>Template *</span>
            {loadingTemplates ? (
              <div style={{ fontSize: "12px", color: "#888780" }}>Loading templates…</div>
            ) : templates.length === 0 ? (
              <div style={{ fontSize: "12px", color: "#888780" }}>No templates saved yet.</div>
            ) : (
              <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} required style={inputStyle}>
                <option value="" disabled>
                  Select a template…
                </option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.itemCount} task{t.itemCount === 1 ? "" : "s"})
                  </option>
                ))}
              </select>
            )}
          </label>

          <ClientJobPicker
            clients={clients}
            selectedClientId={clientId}
            onSelectClient={setClientId}
            selectedJobId={jobId}
            onSelectJob={setJobId}
          />

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
            <button type="button" onClick={onClose} style={secondaryButtonStyle}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !templateId || !jobId}
              style={{ ...primaryButtonStyle, opacity: submitting || !templateId || !jobId ? 0.6 : 1 }}
            >
              {submitting ? "Applying…" : "Apply template"}
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
