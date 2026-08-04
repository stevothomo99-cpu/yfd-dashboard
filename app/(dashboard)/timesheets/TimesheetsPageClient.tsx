"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import {
  computeHoursByClient,
  computeWagesUtilisation,
  UTILISATION_PERIODS,
  type DateRange,
  type PeriodSelection,
  type UtilisationPeriodKey,
  type ClientHoursBreakdown,
} from "@/lib/workOverview";
import type { XpmTimesheet } from "@/types/xpm";

interface StaffOption {
  id: string;
  name: string;
  role: string;
  // False for Partners -- see the note in page.tsx. Kept as data rather than
  // re-deriving from role here so the rule lives in one place.
  countsTowardPracticeTotal: boolean;
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
  selection,
  today,
  clientNamesMap,
  expanded,
  onToggle,
}: {
  staff: StaffOption;
  timesheets: XpmTimesheet[];
  selection: PeriodSelection;
  today: string;
  clientNamesMap: Map<string, string>;
  expanded: boolean;
  onToggle: () => void;
}) {
  const staffIds = useMemo(() => [staff.id], [staff.id]);
  const utilisation = useMemo(
    () => computeWagesUtilisation(timesheets, staffIds, selection, today),
    [timesheets, staffIds, selection, today],
  );
  const byClient = useMemo(
    () => (expanded ? computeHoursByClient(timesheets, staffIds, selection, today, clientNamesMap) : []),
    [expanded, timesheets, staffIds, selection, today, clientNamesMap],
  );

  const nonBillable =
    utilisation.leaveHours + utilisation.internalOtherHours + utilisation.idleHours;
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
  const [period, setPeriod] = useState<UtilisationPeriodKey | "custom">("week");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [showTimeByClient, setShowTimeByClient] = useState(false);
  const [expandedStaffId, setExpandedStaffId] = useState<string | null>(null);

  // Practice-wide tiles count only delivery staff; the By employee table
  // below still lists everyone.
  const practiceStaffIds = useMemo(
    () => staffOptions.filter((s) => s.countsTowardPracticeTotal).map((s) => s.id),
    [staffOptions],
  );
  const excludedNames = useMemo(
    () => staffOptions.filter((s) => !s.countsTowardPracticeTotal).map((s) => s.name),
    [staffOptions],
  );
  const today = todayIso();
  const clientNamesMap = useMemo(() => new Map(Object.entries(clientNamesById)), [clientNamesById]);

  // A half-filled custom range would silently measure something nobody
  // asked for, so it falls back to the last fixed period until both ends
  // are set. Reversed dates are swapped rather than rejected.
  const customComplete = period === "custom" && Boolean(customFrom) && Boolean(customTo);
  const selection: PeriodSelection = useMemo(() => {
    if (!customComplete) return period === "custom" ? "week" : period;
    return customFrom <= customTo
      ? { start: customFrom, end: customTo }
      : { start: customTo, end: customFrom };
  }, [customComplete, period, customFrom, customTo]);

  const utilisation = useMemo(
    () => computeWagesUtilisation(timesheets, practiceStaffIds, selection, today),
    [timesheets, practiceStaffIds, selection, today],
  );

  const byClient = useMemo(
    () => computeHoursByClient(timesheets, practiceStaffIds, selection, today, clientNamesMap),
    [timesheets, practiceStaffIds, selection, today, clientNamesMap],
  );

  // Billable as a share of time actually logged -- XPM's own definition, and
  // the same basis as the per-employee column further down. Leave and idle
  // both count as logged-but-not-billable, matching XPM's Non-Bill column.
  const loggedTotal =
    utilisation.clientHours + utilisation.leaveHours + utilisation.idleHours;
  const billableSharePct =
    loggedTotal > 0 ? Math.round((utilisation.clientHours / loggedTotal) * 100) : null;

  const totalClientHours = byClient.reduce((acc, c) => acc + c.hours, 0);

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle={
          "Billable vs Leave vs non-billable · live from XPM · 38hr/week standard, counted to date, not prorated for part-timers" +
          (excludedNames.length
            ? ` · practice totals exclude ${excludedNames.join(", ")}`
            : "")
        }
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

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center", padding: "0 0 14px" }}>
        {UTILISATION_PERIODS.map((p) => (
          <PeriodButton
            key={p.value}
            label={p.label}
            active={p.value === period}
            onClick={() => setPeriod(p.value)}
          />
        ))}
        <PeriodButton label="Custom…" active={period === "custom"} onClick={() => setPeriod("custom")} />

        {period === "custom" ? (
          <div style={{ display: "flex", gap: "6px", alignItems: "center", marginLeft: "4px" }}>
            <input
              type="date"
              value={customFrom}
              max={customTo || undefined}
              onChange={(e) => setCustomFrom(e.target.value)}
              aria-label="From date"
              style={dateInputStyle}
            />
            <span style={{ fontSize: "12px", color: "#888780" }}>to</span>
            <input
              type="date"
              value={customTo}
              min={customFrom || undefined}
              onChange={(e) => setCustomTo(e.target.value)}
              aria-label="To date"
              style={dateInputStyle}
            />
            {!customComplete ? (
              <span style={{ fontSize: "11px", color: "#888780" }}>
                Pick both dates — showing this week meanwhile.
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div style={{ fontSize: "11px", color: "#888780", padding: "0 0 12px" }}>
        Measuring {fmtRange(utilisation.range)}
        {utilisation.range.end > today ? " (capacity counted to today)" : ""}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: "14px",
          marginBottom: "14px",
        }}
      >
        {/* Two different denominators, side by side on purpose, because
            comparing the wrong one against XPM's own Staff Time Summary
            Report wastes an afternoon:

            "Capacity used"   -- against available capacity to date. Answers
                                 "is the team's time accounted for", and so
                                 falls when people under-log or have spare
                                 capacity.
            "Billable share"  -- against time actually logged. This is the
                                 figure XPM's report calls %, and the same
                                 basis as the per-employee column below.

            For 6 Jul - 2 Aug these read 65% and 81% off identical data. */}
        <KpiCard
          label="Capacity used"
          value={utilisation.pct + "%"}
          sub={
            (
              utilisation.clientHours +
              utilisation.leaveHours +
              utilisation.internalOtherHours
            ).toFixed(1) +
            " of " +
            utilisation.standardHours.toFixed(1) +
            " std hrs to date"
          }
          valueColor={utilisation.pct < 70 ? "#e24b4a" : undefined}
        />
        <KpiCard
          label="Billable share"
          value={billableSharePct !== null ? billableSharePct + "%" : "—"}
          sub={
            billableSharePct !== null
              ? utilisation.clientHours.toFixed(1) + " of " + loggedTotal.toFixed(1) + " hrs logged"
              : "No time logged"
          }
        />
        <KpiCard label="Client hours" value={utilisation.clientHours.toFixed(1) + " hrs"} />
        <KpiCard
          label="Admin / meetings"
          value={utilisation.internalOtherHours.toFixed(1) + " hrs"}
          sub="Paid internal — counts as utilised"
        />
        <KpiCard label="Leave" value={utilisation.leaveHours.toFixed(1) + " hrs"} />
        <KpiCard
          label="Idle"
          value={utilisation.idleHours.toFixed(1) + " hrs"}
          sub="The only time excluded"
          valueColor={utilisation.idleHours > 0 ? "#e24b4a" : undefined}
        />
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
          <div style={{ fontSize: "11px", color: "#888780" }}>
            % = billable share of logged time · click a name for their client breakdown
          </div>
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
                selection={selection}
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

function PeriodButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
      {label}
    </button>
  );
}

function fmtRange(range: DateRange): string {
  const fmt = (iso: string) =>
    new Date(iso + "T00:00:00Z").toLocaleDateString("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  return `${fmt(range.start)} – ${fmt(range.end)}`;
}

const dateInputStyle: React.CSSProperties = {
  fontSize: "12px",
  padding: "5px 8px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  fontFamily: "inherit",
};
