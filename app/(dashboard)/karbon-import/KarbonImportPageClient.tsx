"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { formatDate } from "@/lib/utils";

interface ImportRow {
  workItemKey: string;
  title: string;
  dueDate: string | null;
  startDate: string | null;
  karbonClientName: string;
  karbonAssigneeName: string;
  karbonWorkType: string;
  karbonStatus: string;
  karbonRecurrenceFrequency: string | null;
  customerId: string | null;
  needsClient: boolean;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeIsFallback: boolean;
  statusId: string | null;
  statusName: string | null;
  typeId: string | null;
  typeName: string | null;
  recurrence: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface PreviewResponse {
  mode: "live" | "mock";
  rows: ImportRow[];
  customers: CustomerOption[];
  message?: string;
}

interface ImportResult {
  created: number;
  skipped: string[];
  failed: string[];
}

// Sentinel value for the "Remove from import" option in each row's client
// dropdown -- distinct from "" (which means "no client chosen yet") so a
// removed row can't be confused with one that's merely unresolved.
const REMOVE_VALUE = "__remove__";

const RECURRENCE_LABEL: Record<string, string> = {
  none: "One-off",
  daily: "Daily",
  weekly: "Weekly",
  fortnightly: "Fortnightly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

export default function KarbonImportPageClient() {
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [mode, setMode] = useState<"live" | "mock" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  // Only overrides the customerId this page resolved automatically -- a
  // person only ever needs to touch this dropdown for rows flagged
  // needsClient, but nothing stops fixing an auto-match that guessed wrong.
  const [clientOverrides, setClientOverrides] = useState<Record<string, string>>({});
  // Rows explicitly dropped from the import via the "Remove from import"
  // dropdown option -- kept separate from clientOverrides since a removed
  // row isn't a client choice, it's an exclusion.
  const [removedKeys, setRemovedKeys] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<ImportResult | null>(null);

  async function fetchPreview(): Promise<PreviewResponse> {
    const res = await fetch("/api/karbon/import-preview");
    return (await res.json()) as PreviewResponse;
  }

  function applyPreview(data: PreviewResponse) {
    setMode(data.mode);
    setMessage(data.message ?? null);
    setRows(data.rows);
    setCustomers(data.customers);
    setClientOverrides({});
    setRemovedKeys(new Set());
    setResult(null);
  }

  function applyPreviewError(err: unknown) {
    setMode("live");
    setMessage(err instanceof Error ? err.message : "Failed to load Karbon work items");
    setRows([]);
    setCustomers([]);
  }

  function refresh() {
    setLoading(true);
    fetchPreview().then(applyPreview).catch(applyPreviewError).finally(() => setLoading(false));
  }

  useEffect(() => {
    (async () => {
      try {
        applyPreview(await fetchPreview());
      } catch (err) {
        applyPreviewError(err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  function resolvedCustomerId(row: ImportRow): string | null {
    return clientOverrides[row.workItemKey] ?? row.customerId;
  }

  const visibleRows = useMemo(
    () => rows.filter((r) => !removedKeys.has(r.workItemKey)),
    [rows, removedKeys],
  );

  const unresolvedCount = useMemo(
    () => visibleRows.filter((r) => !resolvedCustomerId(r)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [visibleRows, clientOverrides],
  );

  async function runImport() {
    setImporting(true);
    setResult(null);
    try {
      const payload = {
        rows: visibleRows.map((r) => ({
          workItemKey: r.workItemKey,
          title: r.title,
          customerId: resolvedCustomerId(r),
          assigneeId: r.assigneeId,
          statusId: r.statusId,
          typeId: r.typeId,
          dueDate: r.dueDate,
          startDate: r.startDate,
          recurrence: r.recurrence,
          karbonClientName: r.karbonClientName,
        })),
      };
      const res = await fetch("/api/karbon/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error ?? "Import failed");
        return;
      }
      setResult(data as ImportResult);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Karbon Import"
        subtitle="Every non-completed live Karbon work item, matched to your internal clients/staff/types/statuses. Fix any unmatched client below, then import."
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

      {result ? (
        <div
          style={{
            fontSize: "12px",
            color: "#1e7e34",
            marginBottom: "16px",
            padding: "8px 12px",
            borderRadius: "8px",
            background: "#eaf6ec",
            border: "0.5px solid #bfe6c6",
          }}
        >
          Imported {result.created} work item{result.created === 1 ? "" : "s"}.
          {result.skipped.length > 0 ? ` Skipped ${result.skipped.length} with no client assigned.` : ""}
          {result.failed.length > 0 ? ` ${result.failed.length} failed to save -- check the server log.` : ""}
        </div>
      ) : null}

      {loading ? (
        <div style={{ fontSize: "13px", color: "#888780" }}>Loading Karbon work items…</div>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "10px" }}>
            <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>
              {visibleRows.length} work item{visibleRows.length === 1 ? "" : "s"}
              {unresolvedCount > 0 ? (
                <span style={{ color: "#c0392b", fontWeight: 500 }}> · {unresolvedCount} need a client selected</span>
              ) : null}
              {removedKeys.size > 0 ? (
                <span style={{ color: "#888780", fontWeight: 500 }}>
                  {" "}
                  · {removedKeys.size} removed{" "}
                  <button
                    type="button"
                    onClick={() => setRemovedKeys(new Set())}
                    style={{ fontSize: "12px", color: "#888780", background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}
                  >
                    Restore
                  </button>
                </span>
              ) : null}
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button type="button" onClick={refresh} style={secondaryButtonStyle}>
                Refresh
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={importing || visibleRows.length === 0}
                style={{ ...primaryButtonStyle, opacity: importing || visibleRows.length === 0 ? 0.5 : 1 }}
              >
                {importing ? "Importing…" : `Import ${visibleRows.length} work item${visibleRows.length === 1 ? "" : "s"}`}
              </button>
            </div>
          </div>

          <div style={{ overflowX: "auto", border: "0.5px solid #e1e0d9", borderRadius: "10px" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
              <thead>
                <tr style={{ background: "#f5f4f0" }}>
                  {["Client", "Title", "Assignee", "Type", "Status", "Due", "Start", "Recurrence"].map((label) => (
                    <th
                      key={label}
                      style={{
                        textAlign: "left",
                        padding: "8px 10px",
                        fontWeight: 600,
                        color: "#444441",
                        borderBottom: "0.5px solid #e1e0d9",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row, i) => {
                  const resolved = resolvedCustomerId(row);
                  const flagged = !resolved;
                  return (
                    <tr
                      key={row.workItemKey || i}
                      style={{
                        borderBottom: i === visibleRows.length - 1 ? "none" : "0.5px solid #e1e0d9",
                        background: flagged ? "rgba(226, 75, 74, 0.06)" : undefined,
                      }}
                    >
                      <td style={{ padding: "8px 10px", minWidth: "220px" }}>
                        <select
                          value={resolved ?? ""}
                          onChange={(e) => {
                            if (e.target.value === REMOVE_VALUE) {
                              setRemovedKeys((prev) => new Set(prev).add(row.workItemKey));
                              return;
                            }
                            setClientOverrides((prev) => ({ ...prev, [row.workItemKey]: e.target.value }));
                          }}
                          style={{
                            ...selectCellStyle,
                            border: flagged ? "1px solid #e24b4a" : "0.5px solid #e1e0d9",
                          }}
                        >
                          <option value="">— Select client —</option>
                          {customers.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                          <option value={REMOVE_VALUE}>— Remove from import —</option>
                        </select>
                        <div style={{ fontSize: "10px", color: "#888780", marginTop: "3px" }}>
                          Karbon: {row.karbonClientName || "—"}
                        </div>
                      </td>
                      <td style={tdStyle}>{row.title}</td>
                      <td style={tdStyle}>
                        {row.assigneeName ?? "Unassigned"}
                        {row.assigneeIsFallback ? (
                          <span style={{ marginLeft: "4px", fontSize: "10px", color: "#888780" }}>(defaulted)</span>
                        ) : null}
                      </td>
                      <td style={tdStyle}>{row.typeName ?? "—"}</td>
                      <td style={tdStyle}>{row.statusName ?? "—"}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDate(row.dueDate)}</td>
                      <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{formatDate(row.startDate)}</td>
                      <td style={tdStyle}>{RECURRENCE_LABEL[row.recurrence] ?? row.recurrence}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const tdStyle: React.CSSProperties = {
  padding: "8px 10px",
  color: "#111111",
};

const selectCellStyle: React.CSSProperties = {
  fontSize: "12px",
  padding: "5px 8px",
  borderRadius: "6px",
  background: "white",
  color: "#111111",
  outline: "none",
  width: "100%",
};

const secondaryButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "8px 14px",
  borderRadius: "8px",
  background: "white",
  color: "#444441",
  border: "0.5px solid #e1e0d9",
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 600,
  padding: "8px 14px",
  borderRadius: "8px",
  background: "#111111",
  color: "white",
  border: "none",
  cursor: "pointer",
};
