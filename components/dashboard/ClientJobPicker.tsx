"use client";

import { useEffect, useState } from "react";
import type { JobWithManager } from "@/types/workflow";

interface ClientOption {
  id: string;
  name: string;
}

interface ClientJobPickerProps {
  clients: ClientOption[];
  selectedClientId: string;
  onSelectClient: (clientId: string) => void;
  selectedJobId: string;
  onSelectJob: (jobId: string) => void;
}

// Destination client + job picker shared by the "Copy task" and "Apply
// template" modals. Client selection is a searchable list over the
// already-loaded client tiles (same search-then-click pattern
// ClientsPageClient.tsx uses for its own tile grid, rather than inventing a
// new autocomplete widget) -- no extra fetch needed since callers already
// have the full client list in memory. Once a client is picked, its jobs
// are fetched on demand (small per-client dataset, same
// /api/workflow/customers/[id]/jobs route TileDrawer.tsx already uses); a
// single-job client skips the job dropdown entirely since there's nothing
// to choose.
export default function ClientJobPicker({
  clients,
  selectedClientId,
  onSelectClient,
  selectedJobId,
  onSelectJob,
}: ClientJobPickerProps) {
  const [search, setSearch] = useState("");
  const [jobs, setJobs] = useState<JobWithManager[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);

  useEffect(() => {
    // Nothing to fetch without a client -- render logic below only shows
    // the job section once selectedClientId is set, so there's no stale
    // `jobs` state to clear here.
    if (!selectedClientId) return;

    let cancelled = false;

    const fetchJobs = async () => {
      setLoadingJobs(true);
      try {
        const data = await fetch(`/api/workflow/customers/${selectedClientId}/jobs`).then((r) => r.json());
        if (cancelled) return;
        const fetchedJobs: JobWithManager[] = data.jobs ?? [];
        setJobs(fetchedJobs);
        // A client with exactly one job needs no explicit choice -- select
        // it automatically so the caller can submit right away.
        if (fetchedJobs.length === 1) onSelectJob(fetchedJobs[0].id);
        else onSelectJob("");
      } finally {
        if (!cancelled) setLoadingJobs(false);
      }
    };

    fetchJobs();
    return () => {
      cancelled = true;
    };
    // onSelectJob is intentionally excluded: it's a fresh closure each
    // parent render, and this effect should only re-run when the selected
    // client actually changes, not on every keystroke elsewhere in the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedClientId]);

  const filteredClients = search.trim()
    ? clients.filter((c) => c.name.toLowerCase().includes(search.trim().toLowerCase()))
    : clients;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <span style={labelStyle}>Client</span>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          style={inputStyle}
        />
        <div
          style={{
            maxHeight: "160px",
            overflowY: "auto",
            border: "0.5px solid #e1e0d9",
            borderRadius: "8px",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {filteredClients.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#888780", padding: "10px 12px" }}>No clients match.</div>
          ) : (
            filteredClients.map((c) => {
              const active = c.id === selectedClientId;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => onSelectClient(c.id)}
                  style={{
                    textAlign: "left",
                    fontSize: "13px",
                    padding: "8px 12px",
                    border: "none",
                    borderBottom: "0.5px solid #e1e0d9",
                    background: active ? "#111111" : "white",
                    color: active ? "white" : "#111111",
                    cursor: "pointer",
                  }}
                >
                  {c.name}
                </button>
              );
            })
          )}
        </div>
      </div>

      {selectedClientId ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={labelStyle}>Job</span>
          {loadingJobs ? (
            <div style={{ fontSize: "12px", color: "#888780" }}>Loading jobs…</div>
          ) : jobs.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#888780" }}>This client has no jobs yet.</div>
          ) : jobs.length === 1 ? (
            <div style={{ fontSize: "13px", color: "#111111", padding: "8px 10px", background: "#fafaf8", borderRadius: "8px" }}>
              {jobs[0].name}
            </div>
          ) : (
            <select value={selectedJobId} onChange={(e) => onSelectJob(e.target.value)} style={inputStyle}>
              <option value="" disabled>
                Select a job…
              </option>
              {jobs.map((j) => (
                <option key={j.id} value={j.id}>
                  {j.name}
                </option>
              ))}
            </select>
          )}
        </div>
      ) : null}
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
