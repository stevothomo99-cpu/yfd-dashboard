"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import BasStatusBadge from "@/components/dashboard/BasStatusBadge";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import StaffSlicer from "@/components/layout/StaffSlicer";
import { includedStaff, CLIENT_TILES, findStaff } from "@/lib/mock";
import type { BasStatus } from "@/types/dashboard";

const STATUS_ORDER: Record<BasStatus, number> = {
  "not-started": 0,
  "in-progress": 1,
  lodged: 2,
};

function formatDue(d: string) {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function BasPage() {
  const staff = includedStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const includedIds = new Set(staff.map((s) => s.id));

  const rows = CLIENT_TILES.filter(
    (c) => includedIds.has(c.managerId) && (!selectedId || c.managerId === selectedId),
  ).sort(
    (a, b) => STATUS_ORDER[a.basStatus] - STATUS_ORDER[b.basStatus] || a.name.localeCompare(b.name),
  );

  const counts = {
    lodged: rows.filter((c) => c.basStatus === "lodged").length,
    inProgress: rows.filter((c) => c.basStatus === "in-progress").length,
    notStarted: rows.filter((c) => c.basStatus === "not-started").length,
  };

  return (
    <div>
      <PageHeader title="BAS Status" subtitle="Quarterly Business Activity Statements · current period" />

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
            gridTemplateColumns: "1.4fr 1fr 110px 130px",
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
          <div>Assigned</div>
          <div>Status</div>
          <div style={{ textAlign: "right" }}>Due</div>
        </div>

        {rows.map((c, i) => {
          const mgr = findStaff(c.managerId);
          return (
            <div
              key={c.id}
              style={{
                display: "grid",
                gridTemplateColumns: "1.4fr 1fr 110px 130px",
                padding: "14px 16px",
                alignItems: "center",
                borderBottom: i < rows.length - 1 ? "0.5px solid #e1e0d9" : "none",
              }}
            >
              <div style={{ fontSize: "13px", color: "#111111", fontWeight: 500 }}>{c.name}</div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                {mgr ? <StaffAvatar initials={mgr.initials} size={26} /> : null}
                <span style={{ fontSize: "12px", color: "#444441" }}>{c.managerName}</span>
              </div>
              <div>
                <BasStatusBadge status={c.basStatus} />
              </div>
              <div style={{ textAlign: "right", fontSize: "12px", color: "#444441" }}>
                {formatDue("2026-06-28")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
