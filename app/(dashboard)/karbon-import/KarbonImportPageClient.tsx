"use client";

import { useEffect, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";

// The task fields this app actually has to fill in when a Karbon WorkItem
// becomes a task (see CreateTaskInput in types/workflow.ts). Recurrence has
// no Karbon counterpart -- Karbon doesn't model repeating work the way this
// app does -- so it's listed but never auto-guessed.
const TARGET_FIELDS: { key: string; label: string }[] = [
  { key: "title", label: "Title" },
  { key: "client", label: "Client" },
  { key: "assignee", label: "Assignee" },
  { key: "type", label: "Type" },
  { key: "dueDate", label: "Due Date" },
  { key: "startDate", label: "Start Date" },
  { key: "status", label: "Status" },
  { key: "recurrence", label: "Recurrence" },
];

// Listed most-specific first: a WorkItem usually carries both a "*Name" and
// a "*Key" variant of the same thing (e.g. ClientName/ClientKey) and the
// name is what a human reviewing this page wants to see, so it's tried
// before the bare keyword falls back to matching the Key field instead.
const GUESS_KEYWORDS: Record<string, string[]> = {
  title: ["title"],
  client: ["clientname", "client"],
  assignee: ["assigneename", "assignee"],
  type: ["worktype", "type"],
  dueDate: ["duedate"],
  startDate: ["startdate"],
  status: ["primarystatus", "status"],
  // Karbon has no frequency field on the WorkItem itself -- the API route
  // joins it in from the linked WorkSchedule (see withScheduleFrequency in
  // app/api/karbon/import-preview/route.ts) under this same name.
  recurrence: ["recurrencefrequency"],
};

interface PreviewResponse {
  mode: "live" | "mock";
  rows: Record<string, unknown>[];
  message?: string;
}

function collectFields(rows: Record<string, unknown>[]): string[] {
  const seen = new Set<string>();
  const fields: string[] = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!seen.has(key)) {
        seen.add(key);
        fields.push(key);
      }
    }
  }
  return fields;
}

// Best-effort starting layout so a person only has to fix the handful of
// fields Karbon names unhelpfully, rather than dragging all eight from
// scratch every time this page loads.
function guessInitialMapping(fields: string[]): Record<string, string | null> {
  const used = new Set<string>();
  const lowerPairs = fields.map((f) => [f, f.toLowerCase()] as const);
  const mapping: Record<string, string | null> = {};
  for (const target of TARGET_FIELDS) {
    let match: string | null = null;
    for (const kw of GUESS_KEYWORDS[target.key] ?? []) {
      const found = lowerPairs.find(([f, lower]) => !used.has(f) && lower.includes(kw));
      if (found) {
        match = found[0];
        break;
      }
    }
    if (match) used.add(match);
    mapping[target.key] = match;
  }
  return mapping;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

export default function KarbonImportPageClient() {
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<"live" | "mock" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [karbonFields, setKarbonFields] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string | null>>({});
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  async function fetchKarbonPreview(): Promise<PreviewResponse> {
    const res = await fetch("/api/karbon/import-preview");
    return (await res.json()) as PreviewResponse;
  }

  function applyPreview(data: PreviewResponse) {
    const fields = collectFields(data.rows);
    setMode(data.mode);
    setMessage(data.message ?? null);
    setRows(data.rows);
    setKarbonFields(fields);
    setMapping(guessInitialMapping(fields));
  }

  function applyPreviewError(err: unknown) {
    setMode("live");
    setMessage(err instanceof Error ? err.message : "Failed to load Karbon sample data");
    setRows([]);
    setKarbonFields([]);
    setMapping({});
  }

  useEffect(() => {
    (async () => {
      try {
        applyPreview(await fetchKarbonPreview());
      } catch (err) {
        applyPreviewError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function refreshSample() {
    setLoading(true);
    fetchKarbonPreview().then(applyPreview).catch(applyPreviewError).finally(() => setLoading(false));
  }

  // A dragged Karbon field always ends up mapped to at most one target: it's
  // cleared from wherever it used to be (another slot, or nowhere if it came
  // from the unassigned pool) before landing here.
  function assignField(targetKey: string, karbonField: string) {
    setMapping((prev) => {
      const next: Record<string, string | null> = {};
      for (const [k, v] of Object.entries(prev)) next[k] = v === karbonField ? null : v;
      next[targetKey] = karbonField;
      return next;
    });
  }

  function unassignField(targetKey: string) {
    setMapping((prev) => ({ ...prev, [targetKey]: null }));
  }

  const mappedFields = new Set(Object.values(mapping).filter((v): v is string => Boolean(v)));
  const unassignedFields = karbonFields.filter((f) => !mappedFields.has(f));

  function chipStyle(dragging: boolean): React.CSSProperties {
    return {
      display: "inline-flex",
      alignItems: "center",
      gap: "4px",
      padding: "6px 10px",
      borderRadius: "8px",
      background: dragging ? "#eceae2" : "#f5f4f0",
      border: "0.5px solid #e1e0d9",
      fontSize: "12px",
      fontWeight: 500,
      color: "#111111",
      cursor: "grab",
      userSelect: "none",
    };
  }

  function slotStyle(targetKey: string): React.CSSProperties {
    const isOver = dragOverKey === targetKey;
    return {
      minHeight: "56px",
      borderRadius: "10px",
      border: isOver ? "1.5px dashed #6b6a63" : "0.5px dashed #cfcdc4",
      background: isOver ? "#f0efe9" : "#fbfaf7",
      padding: "8px 10px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      justifyContent: "center",
    };
  }

  return (
    <div>
      <PageHeader
        title="Karbon Import"
        subtitle="Drag a Karbon field onto the dashboard field it should fill. The preview table below updates as you go."
      />

      {message ? (
        <div
          style={{
            fontSize: "12px",
            color: mode === "mock" ? "#888780" : "#c0392b",
            marginBottom: "16px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: mode === "mock" ? "#f5f4f0" : "#fdecea",
            border: `0.5px solid ${mode === "mock" ? "#e1e0d9" : "#f0b8b8"}`,
          }}
        >
          {message}
        </div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: "13px", color: "#888780" }}>Loading sample work items…</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>Dashboard fields</div>
            <button
              type="button"
              onClick={refreshSample}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                padding: "6px 12px",
                borderRadius: "8px",
                background: "white",
                color: "#444441",
                border: "0.5px solid #e1e0d9",
                cursor: "pointer",
              }}
            >
              Refresh sample
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(4, 1fr)",
              gap: "10px",
              marginBottom: "20px",
            }}
          >
            {TARGET_FIELDS.map((target) => {
              const karbonField = mapping[target.key] ?? null;
              return (
                <div
                  key={target.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverKey(target.key);
                  }}
                  onDragLeave={() => setDragOverKey((k) => (k === target.key ? null : k))}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverKey(null);
                    const field = e.dataTransfer.getData("text/karbon-field");
                    if (field) assignField(target.key, field);
                  }}
                  style={slotStyle(target.key)}
                >
                  <div style={{ fontSize: "11px", color: "#888780", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    {target.label}
                  </div>
                  {karbonField ? (
                    <div
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/karbon-field", karbonField)}
                      style={{ display: "flex", alignItems: "center", gap: "6px" }}
                    >
                      <span style={chipStyle(false)}>{karbonField}</span>
                      <button
                        type="button"
                        onClick={() => unassignField(target.key)}
                        title="Remove mapping"
                        style={{
                          border: "none",
                          background: "none",
                          color: "#888780",
                          cursor: "pointer",
                          fontSize: "13px",
                          lineHeight: 1,
                          padding: "2px",
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ) : (
                    <div style={{ fontSize: "12px", color: "#b3b1a8" }}>Drop a Karbon field here</div>
                  )}
                </div>
              );
            })}
          </div>

          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const field = e.dataTransfer.getData("text/karbon-field");
              if (!field) return;
              setMapping((prev) => {
                const next: Record<string, string | null> = {};
                for (const [k, v] of Object.entries(prev)) next[k] = v === field ? null : v;
                return next;
              });
            }}
            style={{
              border: "0.5px solid #e1e0d9",
              borderRadius: "10px",
              padding: "12px",
              marginBottom: "24px",
              background: "white",
            }}
          >
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111", marginBottom: "8px" }}>
              Karbon fields (unassigned)
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {unassignedFields.length === 0 ? (
                <div style={{ fontSize: "12px", color: "#b3b1a8" }}>Every Karbon field is mapped.</div>
              ) : (
                unassignedFields.map((field) => (
                  <div
                    key={field}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData("text/karbon-field", field)}
                    style={{ display: "flex", flexDirection: "column", alignItems: "flex-start" }}
                  >
                    <span style={chipStyle(false)}>{field}</span>
                    <span style={{ fontSize: "10px", color: "#b3b1a8", marginTop: "2px", maxWidth: "160px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {formatCell(rows[0]?.[field]) || "—"}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111", marginBottom: "8px" }}>
            Preview — {rows.length} sample work item{rows.length === 1 ? "" : "s"}
          </div>
          <div style={{ overflowX: "auto", border: "0.5px solid #e1e0d9", borderRadius: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f5f4f0" }}>
                  {TARGET_FIELDS.map((target) => (
                    <th
                      key={target.key}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        fontWeight: 600,
                        color: "#444441",
                        borderBottom: "0.5px solid #e1e0d9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {target.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i} style={{ borderBottom: i === rows.length - 1 ? "none" : "0.5px solid #e1e0d9" }}>
                    {TARGET_FIELDS.map((target) => {
                      const karbonField = mapping[target.key];
                      const value = karbonField ? formatCell(row[karbonField]) : "";
                      return (
                        <td key={target.key} style={{ padding: "8px 10px", color: value ? "#111111" : "#b3b1a8", whiteSpace: "nowrap" }}>
                          {value || "—"}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
