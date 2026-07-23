"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import {
  computeHoursByClient,
  computeWagesUtilisation,
  UTILISATION_PERIODS,
  type UtilisationPeriodKey,
  type ClientHoursBreakdown,
} from "@/lib/workOverview";
import type { XpmTimesheet } from "@/types/xpm";

interface StaffOption {
  id: string;
  name: string;
}

interface TimesheetsPageClientProps {
  timesheets: XpmTimesheet[];
  staffOptions: StaffOption[];
  clientNamesById: Record<string, string>;
  message: string | null;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function ClientBreakdownList({ byClient, totalHours }: { byClient: ClientHoursBreakdown[]; totalHours: number }) {
  if (byClient.length === 0) {
    return <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>No client-coded time logged for this period.</div>;
  }
  return (
    <div style={{ display: "flex", flexDirection: "column" }}>
      {byClient.map((c, i) => {
        const pct = totalHours > 0 ? Math.round((c.hours / totalHours) * 100) : 0;
        return (
          <div
            key={c.clientId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 0",
              borderBottom: i < byClient.length - 1 ? "0.5px solid #e1e0d9" : "none",
            }}
          >
            <div style={{ flex: 1, fontSize: "13px", color: "#111111" }}>{c.clientName}</div>
            <div style={{ width: "160px", height: "6px", background: "#f5f4f0", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ width: pct + "%", height: "100%", background: "#2a78d6" }} />
            </div>
            <div style={{ width: "70px", textAlign: "right", fontSize: "12px", color: "#444441" }}>{c.hours.toFixed(1)}h</div>
          </div>
        );
      })}
    </div>
  );
}

function EmployeeRow({
  staff,
  timesheets,
  period,
  today,
  clientNamesMap,
  expanded,
  onToggle,
}: {
  staff: StaffOption;
  timesheets: XpmTimesheet[];
  period: UtilisationPeriodKey;
  today: string;
  clientNamesMap: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const staffIds = useMemo(() => [staff.id], [staff.id]);
  const utilisation = useMemo(
    () => computeWagesUtilisation(timesheets, staffIds, period, today),
    [timesheets, staffIds, period, today],
  );
  const byClient = useMemo(
    () => (expanded ? computeHoursByClient(timesheets, staffIds, period, today, clientNamesMap) : []),
    [expanded, timesheets, staffIds, period, today, clientNamesMap],
  );

  const nonBillable = utilisation.leaveHours + utilisation.idleHours;
  const loggedTotal = utilisation.clientHours + nonBillable;
  const billablePct = loggedTotal > 0 ? Math.round((utilisation.clientHours / loggedTotal) * 100) : null;

  return (
    <div style={{ borderBottom: "0.5px solid #e1e0d9" }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          width: "100%",
          padding: "10px 0",
          background: "none",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
        }}
      >
        <div style={{ fontSize: "11px", color: "#888780", width: "12px" }}>{expanded ? "▾" : "▸"}</div>
        <div style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#111111" }}>{staff.name}</div>
        <div style={{ width: "90px", textAlign: "right", fontSize: "12px", color: "#444441" }}>
          {utilisation.clientHours.toFixed(1)}h billable
        </div>
        <div style={{ width: "110px", textAlign: "right", fontSize: "12px", color: "#888780" }}>
          {nonBillable.toFixed(1)}h non-billable
        </div>
        <div style={{ width: "60px", textAlign: "right", fontSize: "12px", fontWeight: 500, color: billablePct !== null && billablePct < 50 ? "#e24b4a" : "#444441" }}>
          {billablePct !== null ? `${billablePct}%` : "—"}
        </div>
      </button>
      {expanded ? (
        <div style={{ padding: "0 0 12px 24px" }}>
          <ClientBreakdownList byClient={byClient} totalHours={utilisation.clientHours} />
        </div>
      ) : null}
    </div>
  );
}

export default function TimesheetsPageClient({
  timesheets,
  staffOptions,
  clientNamesById,
  message,
}: TimesheetsPageClientProps) {
  const [period, setPeriod] = useState<UtilisationPeriodKey>("week");
  const [showTimeByClient, setShowTimeByClient] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  const allStaffIds = useMemo(() => staffOptions.map((s) => s.id), [staffOptions]);
  const today = todayIso();
  const clientNamesMap = useMemo(() => new Map(Object.entries(clientNamesById)), [clientNamesById]);

  const utilisation = useMemo(
    () => computeWagesUtilisation(timesheets, allStaffIds, period, today),
    [timesheets, allStaffIds, period, today],
  );

  const byClient = useMemo(
    () => computeHoursByClient(timesheets, allStaffIds, period, today, clientNamesMap),
    [timesheets, allStaffIds, period, today, clientNamesMap],
  );

  const totalClientHours = byClient.reduce((acc, c) => acc + c.hours, 0);

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle="Billable vs Leave vs non-billable · live from XPM · full 38hr/week standard, not prorated"
      />

      {message ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "14px",
          }}
        >
          {message}
        </div>
      ) : null}

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", padding: "0 0 14px" }}>
        {UTILISATION_PERIODS.map((p) => {
          const active = p.value === period;
          return (
            <button
              key={p.value}
              type="button"
              onClick={() => setPeriod(p.value)}
              style={{
                fontSize: "12px",
                fontWeight: 500,
                padding: "6px 12px",
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

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        <KpiCard
          label="Billable %"
          value={utilisation.pct + "%"}
          sub={(utilisation.clientHours + utilisation.leaveHours).toFixed(1) + " of " + utilisation.standardHours.toFixed(1) + " std hrs"}
          valueColor={utilisation.pct < 70 ? "#e24b4a" : undefined}
        />
        <KpiCard label="Client hours" value={utilisation.clientHours.toFixed(1) + " hrs"} />
        <KpiCard label="Leave" value={utilisation.leaveHours.toFixed(1) + " hrs"} />
        <KpiCard label="Idle / non-billable" value={utilisation.idleHours.toFixed(1) + " hrs"} />
      </div>

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.1rem 1.2rem",
          marginBottom: "14px",
        }}
      >
        <button
          type="button"
          onClick={() => setShowTimeByClient((v) => !v)}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            width: "100%",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: 0,
            marginBottom: showTimeByClient ? "14px" : 0,
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
            {showTimeByClient ? "▾" : "▸"} Time by client (all staff)
          </div>
          <div style={{ fontSize: "11px", color: "#888780" }}>{totalClientHours.toFixed(1)} hrs total</div>
        </button>

        {showTimeByClient ? <ClientBreakdownList byClient={byClient} totalHours={totalClientHours} /> : null}
      </div>

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.1rem 1.2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>By employee</div>
          <div style={{ fontSize: "11px", color: "#888780" }}>Click a name for their client breakdown</div>
        </div>

        {staffOptions.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>No staff to show.</div>
        ) : (
          <div>
            {staffOptions.map((s) => (
              <EmployeeRow
                key={s.id}
                staff={s}
                timesheets={timesheets}
                period={period}
                today={today}
                clientNamesMap={clientNamesMap}
                expanded={expandedStaffId === s.id}
                onToggle={() => setExpandedStaffId((cur) => (cur === s.id ? null : s.id))}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
