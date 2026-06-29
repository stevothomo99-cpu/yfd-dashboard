"use client";

import Link from "next/link";
import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import PeriodToggle from "@/components/dashboard/PeriodToggle";
import ScoreBadge from "@/components/dashboard/ScoreBadge";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import StaffSlicer from "@/components/layout/StaffSlicer";
import { includedStaff } from "@/lib/mock";
import type { PeriodFilter } from "@/types/dashboard";

export default function LeaderboardPage() {
  const staff = includedStaff();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodFilter>("week");

  const rows = [...staff]
    .filter((s) => !selectedId || s.id === selectedId)
    .sort((a, b) => b.score - a.score);

  return (
    <div>
      <PageHeader
        title="Leaderboard"
        subtitle="Composite score · 50% billable, 30% tasks done, 20% BAS on-time"
        action={<PeriodToggle value={period} onChange={setPeriod} />}
      />

      <StaffSlicer staff={staff} selectedId={selectedId} onChange={setSelectedId} />

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
            gridTemplateColumns: "48px 1fr 90px 90px 110px 70px",
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
          <div>Rank</div>
          <div>Staff</div>
          <div style={{ textAlign: "right" }}>Billable %</div>
          <div style={{ textAlign: "right" }}>Tasks done</div>
          <div style={{ textAlign: "right" }}>Tasks overdue</div>
          <div style={{ textAlign: "right" }}>Score</div>
        </div>

        {rows.map((s, i) => (
          <Link
            key={s.id}
            href={"/staff/" + s.id}
            style={{ textDecoration: "none", color: "inherit" }}
          >
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "48px 1fr 90px 90px 110px 70px",
                alignItems: "center",
                padding: "14px 16px",
                borderBottom: i < rows.length - 1 ? "0.5px solid #e1e0d9" : "none",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: "13px", color: "#888780", fontWeight: 500 }}>
                {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <StaffAvatar initials={s.initials} size={32} />
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>
                    {s.name}
                  </div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: 2 }}>
                    {s.xpmRole}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: "13px", color: "#111111", textAlign: "right" }}>
                {s.billablePct}%
              </div>
              <div style={{ fontSize: "13px", color: "#111111", textAlign: "right" }}>
                {s.tasksDone}
              </div>
              <div
                style={{
                  fontSize: "13px",
                  color: s.tasksOverdue > 0 ? "#A32D2D" : "#888780",
                  textAlign: "right",
                  fontWeight: s.tasksOverdue > 0 ? 600 : 400,
                }}
              >
                {s.tasksOverdue}
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <ScoreBadge score={s.score} />
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
