"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import BasStatusBadge from "@/components/dashboard/BasStatusBadge";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import StaffSlicer from "@/components/layout/StaffSlicer";
import StatusFilter, { applyStatusFilter, type StatusFilterValue } from "@/components/layout/StatusFilter";
import { initialsOf, staffFromAssignees } from "@/lib/utils";
import type { BasStatus } from "@/types/dashboard";
import type { KarbonUser, KarbonWorkStatus } from "@/types/karbon";
import type { BasSnapshot } from "./page";

const STATUS_ORDER: Record<BasStatus, number> = {
  "not-started": 0,
  "in-progress": 1,
  lodged: 2,
};

const WORK_STATUS_TO_BAS: Record<KarbonWorkStatus, BasStatus> = {
  notStarted: "not-started",
  inProgress: "in-progress",
  complete: "lodged",
};

function formatDue(d: string) {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BasPageClient({
  initial,
  staff: karbonUsers,
}: {
  initial: BasSnapshot;
  staff: KarbonUser[];
}) {
  const [data, setData] = useState(initial);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilterValue>({ selected: [], mode: "exclude" });

  async function handleRefresh() {
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/karbon/work", { method: "POST" });
      const body: BasSnapshot = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Failed to refresh BAS status.");
      setData(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh BAS status.");
    } finally {
      setRefreshing(false);
    }
  }

  const items = data.workItems;
  const staff = staffFromAssignees(
    karbonUsers.map((u) => ({ assigneeId: u.id, assigneeName: u.name })),
  );

  const staffFiltered = items
    .filter((w) => !selectedId || w.assigneeId === selectedId)
    .map((w) => ({ ...w, basStatus: WORK_STATUS_TO_BAS[w.status] }));

  const statusOptions = Array.from(new Set(items.map((w) => w.rawStatus).filter(Boolean))).sort();

  const rows = applyStatusFilter(staffFiltered, statusFilter).sort(
    (a, b) =>
      STATUS_ORDER[a.basStatus] - STATUS_ORDER[b.basStatus] || a.clientName.localeCompare(b.clientName),
  );

  const counts = {
    lodged: staffFiltered.filter((c) => c.basStatus === "lodged").length,
    inProgress: staffFiltered.filter((c) => c.basStatus === "in-progress").length,
    notStarted: staffFiltered.filter((c) => c.basStatus === "not-started").length,
  };

  return (
    <div>
      <PageHeader
        title="BAS Status"
        subtitle="Sourced from Karbon work items · refreshed every 10 minutes"
        action={
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontSize: "12px",
              fontWeight: 500,
              padding: "6px 12px",
              borderRadius: "999px",
              background: "white",
              color: "#444441",
              border: "0.5px solid #e1e0d9",
              cursor: refreshing ? "default" : "pointer",
            }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        }
      />

      {data.mode === "mock" ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          Showing mock data — {data.message ?? "Karbon is not configured."}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            fontSize: "12px",
            color: "#501313",
            background: "#FCEBEB",
            border: "0.5px solid #f0b8b8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      ) : null}

      {data.mode === "live" && !data.basWorkTypeFilter ? (
        <div
          style={{
            fontSize: "12px",
            color: "#0C447C",
            background: "#E6F1FB",
            border: "0.5px solid #b9d8f2",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          This list isn&apos;t narrowed to BAS work yet — set <code>KARBON_BAS_WORK_TYPE</code> in
          Vercel to the exact Work Type label shown in the Type column below for BAS lodgements.
        </div>
      ) : null}

      <StaffSlicer staff={staff} selectedId={selectedId} onChange={setSelectedId} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <KpiCard label="Lodged" value={String(counts.lodged)} valueColor="#1baf7a" sub="Complete" />
        <KpiCard label="In progress" value={String(counts.inProgress)} valueColor="#eda100" sub="Started, not lodged" />
        <KpiCard
          label="Not started"
          value={String(counts.notStarted)}
          valueColor={counts.notStarted > 0 ? "#e24b4a" : "#111111"}
          sub="Work to begin"
        />
      </div>

      <div style={{ marginBottom: "12px" }}>
        <StatusFilter options={statusOptions} value={statusFilter} onChange={setStatusFilter} />
      </div>

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1.2fr 1fr 1fr 110px 130px",
            padding: "12px 16px",
            background: "#fafaf8",
            borderBottom: "0.5px solid #e1e0d9",
            fontSize: "11px",
            fontWeight: 500,
            color: "#888780",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          <div>Client</div>
          <div>Type</div>
          <div>Assigned</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Due</div>
        </div>

        {rows.length === 0 ? (
          <div style={{ padding: "24px 16px", fontSize: "12px", color: "#888780" }}>
            {statusFilter.selected.length === 0 ? "No work items found." : "Nothing matches this filter."}
          </div>
        ) : (
          rows.map((w, i) => (
            <div
              key={w.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.2fr 1fr 1fr 110px 130px",
                padding: "14px 16px",
                alignItems: "center",
                borderBottom: i < rows.length - 1 ? "0.5px solid #e1e0d9" : "none",
              }}
            >
              <div style={{ fontSize: "13px", color: "#111111", fontWeight: 500 }}>{w.clientName}</div>
              <div style={{ fontSize: "12px", color: "#444441" }}>{w.type || "—"}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {w.assigneeName ? <StaffAvatar initials={initialsOf(w.assigneeName)} size={26} /> : null}
                <span style={{ fontSize: "12px", color: "#444441" }}>{w.assigneeName || "Unassigned"}</span>
              </div>
              <div>
                <BasStatusBadge status={w.basStatus} />
                {w.rawStatus ? (
                  <div style={{ fontSize: "10px", color: "#888780", marginTop: "3px" }}>{w.rawStatus}</div>
                ) : null}
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", color: "#444441" }}>
                {formatDue(w.dueDate)}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
