"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import type { JobWithCustomer, WorkflowStaff } from "@/types/workflow";

interface JobsPageClientProps {
  partners: WorkflowStaff[];
  defaultPartnerId: string | null;
  managers: WorkflowStaff[];
  jobs: JobWithCustomer[];
}

const ALL_MANAGERS = "all";

export default function JobsPageClient({
  partners,
  defaultPartnerId,
  managers,
  jobs: initialJobs,
}: JobsPageClientProps) {
  const [partnerId, setPartnerId] = useState<string | null>(defaultPartnerId);
  const [jobs, setJobs] = useState<JobWithCustomer[]>(initialJobs);
  const [managerId, setManagerId] = useState<string>(ALL_MANAGERS);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);

  async function handlePartnerChange(nextPartnerId: string) {
    setPartnerId(nextPartnerId);
    setManagerId(ALL_MANAGERS);
    setLoading(true);
    try {
      const res = await fetch(`/api/workflow/jobs?partnerId=${nextPartnerId}`);
      const data = await res.json();
      setJobs(data.jobs ?? []);
    } finally {
      setLoading(false);
    }
  }

  const managerNameById = useMemo(() => new Map(managers.map((m) => [m.id, m.name])), [managers]);

  const filteredJobs = useMemo(() => {
    return jobs
      .filter((j) => managerId === ALL_MANAGERS || j.managerId === managerId)
      .filter(
        (j) =>
          !search.trim() ||
          j.customerName.toLowerCase().includes(search.trim().toLowerCase()) ||
          j.name.toLowerCase().includes(search.trim().toLowerCase())
      )
      .sort((a, b) => a.customerName.localeCompare(b.customerName));
  }, [jobs, managerId, search]);

  if (!partnerId) {
    return (
      <div>
        <PageHeader
          title="Jobs"
          subtitle="Partner-scoped, in-progress jobs by attached Manager"
        />
        <EmptyState message="No Partner is set up yet. Add a Partner row to the staff table to get started." />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Jobs"
        subtitle="Prototype -- sourced from the new work-item tables, replacing the old Karbon-backed Tasks/BAS views"
      />

      <div style={filterRowStyle}>
        <select
          value={partnerId}
          onChange={(e) => handlePartnerChange(e.target.value)}
          style={selectStyle}
        >
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              Partner: {p.name}
            </option>
          ))}
        </select>

        <select value={managerId} onChange={(e) => setManagerId(e.target.value)} style={selectStyle}>
          <option value={ALL_MANAGERS}>All managers</option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
            </option>
          ))}
        </select>

        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients or jobs…"
          style={searchStyle}
        />
      </div>

      {loading ? (
        <EmptyState message="Loading jobs…" />
      ) : filteredJobs.length === 0 ? (
        <EmptyState message="No in-progress jobs match the current filters." />
      ) : (
        <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f5f4f0", borderBottom: "0.5px solid #e1e0d9" }}>
                <th style={thStyle}>Client</th>
                <th style={thStyle}>Job</th>
                <th style={thStyle}>Manager</th>
              </tr>
            </thead>
            <tbody>
              {filteredJobs.map((j) => (
                <tr key={j.id} style={{ borderBottom: "0.5px solid #e1e0d9" }}>
                  <td style={tdStyle}>{j.customerName}</td>
                  <td style={tdStyle}>{j.name}</td>
                  <td style={tdStyle}>{j.managerId ? managerNameById.get(j.managerId) ?? "Unassigned" : "Unassigned"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "48px 24px",
        textAlign: "center",
        color: "#888780",
        fontSize: "13px",
      }}
    >
      {message}
    </div>
  );
}

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  gap: "8px",
  alignItems: "center",
  padding: "12px 0 18px",
  flexWrap: "wrap",
};

const selectStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "7px 12px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
};

const searchStyle: React.CSSProperties = {
  marginLeft: "8px",
  fontSize: "12px",
  padding: "7px 12px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  minWidth: "220px",
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  fontSize: "11px",
  fontWeight: 600,
  color: "#888780",
  textTransform: "uppercase",
  letterSpacing: "0.03em",
};

const tdStyle: React.CSSProperties = {
  padding: "12px 16px",
  fontSize: "13px",
  color: "#111111",
};
