"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import StaffSlicer from "@/components/layout/StaffSlicer";
import WeeklyTrendChart from "@/components/charts/WeeklyTrendChart";
import { includedStaff } from "@/lib/mock";

const WEEKLY_TARGET_PER_STAFF = 24;

export default function TimesheetsPage() {
  const staff = includedStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(
    () => (selectedId ? staff.filter((s) => s.id === selectedId) : staff),
    [staff, selectedId],
  );

  const totals = useMemo(() => {
    const billable = filtered.reduce((acc, s) => acc + s.billableHours, 0);
    const nonBillable = filtered.reduce((acc, s) => acc + s.nonBillableHours, 0);
    const total = billable + nonBillable;
    return {
      billable,
      nonBillable,
      pct: total > 0 ? Math.round((billable / total) * 100) : 0,
    };
  }, [filtered]);

  const monthFactor = 4.1;
  const ytdFactor = 47;

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Billable vs non-billable hours · live from XPM"
      />

      <StaffSlicer staff={staff} selectedId={selectedId} onChange={setSelectedId} />

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <KpiCard
          label="This week"
          value={totals.billable.toFixed(1) + " hrs"}
          sub={"Billable · " + totals.pct + "% of total · non-billable " + totals.nonBillable.toFixed(1) + " hrs"}
        />
        <KpiCard
          label="This month"
          value={(totals.billable * monthFactor).toFixed(0) + " hrs"}
          sub={"Billable · target " + Math.round(filtered.length * WEEKLY_TARGET_PER_STAFF * monthFactor) + " hrs"}
        />
        <KpiCard
          label="Year to date (FY26)"
          value={(totals.billable * ytdFactor).toFixed(0) + " hrs"}
          sub={"Billable · 88% of FY target"}
        />
      </div>

      <div style={{ marginBottom: "14px" }}>
        <WeeklyTrendChart />
      </div>

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.1rem 1.2rem",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "14px" }}>
          Hours vs weekly target ({WEEKLY_TARGET_PER_STAFF}h)
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {filtered.map((s) => {
            const total = s.billableHours + s.nonBillableHours;
            const billablePct = Math.min(Math.round((s.billableHours / WEEKLY_TARGET_PER_STAFF) * 100), 100);
            const nonBillablePct = Math.min(
              Math.round((s.nonBillableHours / WEEKLY_TARGET_PER_STAFF) * 100),
              100 - billablePct,
            );
            return (
              <div key={s.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <StaffAvatar initials={s.initials} size={32} />
                <div style={{ flex: 1 }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      marginBottom: "5px",
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
                      {s.name}
                    </span>
                    <span style={{ fontSize: "12px", color: "#444441" }}>
                      <strong style={{ color: "#111111" }}>{s.billableHours}</strong>
                      <span style={{ color: "#888780" }}>
                        {" "}
                        + {s.nonBillableHours} non-bill · {total.toFixed(1)}/{WEEKLY_TARGET_PER_STAFF}h
                      </span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: "8px",
                      background: "#f5f4f0",
                      borderRadius: "4px",
                      overflow: "hidden",
                      display: "flex",
                    }}
                  >
                    <div style={{ width: billablePct + "%", background: "#2a78d6" }} />
                    <div style={{ width: nonBillablePct + "%", background: "#888780" }} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
