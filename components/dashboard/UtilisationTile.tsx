"use client";

import { useState } from "react";
import { UTILISATION_PERIODS, type UtilisationPeriodKey, type WagesUtilisationResult } from "@/lib/workOverview";

interface Props {
  summary: Record<UtilisationPeriodKey, WagesUtilisationResult> | null;
  message: string | null;
}

// Small tile with a time slicer -- shows one period's billable % at a time
// (not all four at once), same period-toggle idea as WebMetricsTile's
// 24h/week/month selector on /personal. billable% = (client + leave
// hours) / the full 38hr/week standard for the period -- never prorated
// to elapsed days, so it reads low early in a period and rises as time
// gets logged.
export default function UtilisationTile({ summary, message }: Props) {
  const [period, setPeriod] = useState<UtilisationPeriodKey>("week");

  return (
    <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", padding: "1.1rem 1.2rem" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "10px" }}>
        <div
          style={{
            fontSize: "10px",
            fontWeight: 500,
            color: "#888780",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
          }}
        >
          Utilisation
        </div>
        {summary ? (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", justifyContent: "flex-end" }}>
            {UTILISATION_PERIODS.map((p) => {
              const active = p.value === period;
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPeriod(p.value)}
                  style={{
                    fontSize: "10px",
                    fontWeight: 500,
                    padding: "3px 8px",
                    borderRadius: "999px",
                    background: active ? "#111111" : "white",
                    color: active ? "white" : "#444441",
                    border: "0.5px solid " + (active ? "#111111" : "#e1e0d9"),
                    cursor: "pointer",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      {!summary ? (
        <div style={{ fontSize: "12px", color: "#888780" }}>{message}</div>
      ) : (
        <>
          <div style={{ fontSize: "26px", fontWeight: 500, color: "#111111", lineHeight: 1 }}>
            {summary[period].pct}%
          </div>
          <div style={{ fontSize: "12px", color: "#888780", marginTop: "6px" }}>
            {(summary[period].clientHours + summary[period].leaveHours).toFixed(1)} of{" "}
            {summary[period].standardHours.toFixed(1)} std hrs
          </div>
        </>
      )}
    </div>
  );
}
