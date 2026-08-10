"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import { formatDate } from "@/lib/utils";
import {
  computeHoursByClient,
  computeWagesUtilisation,
  periodBounds,
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

// One width for every numeric column, shared by the header and the data
// rows so the two can't drift out of alignment.
const CELL_WIDTH = "84px";

function Cell({
  children,
  dim,
  strong,
  color,
}: {
  children: React.ReactNode;
  dim?: boolean;
  strong?: boolean;
  color?: string;
}) {
  return (
    <div
      style={{
        width: CELL_WIDTH,
        flex: "0 0 auto",
        textAlign: "right",
        fontSize: "12px",
        fontWeight: strong ? 600 : 400,
        color: color ?? (dim ? "#888780" : "#444441"),
      }}
    >
      {children}
    </div>
  );
}

function HeadCell({ children }: { children: React.ReactNode }) {
  return <div style={{ width: CELL_WIDTH, flex: "0 0 auto", textAlign: "right" }}>{children}</div>;
}

function fmtVariance(hours: number): string {
  if (Math.abs(hours) < 0.05) return "—";
  return hours > 0 ? `${hours.toFixed(1)} short` : `${Math.abs(hours).toFixed(1)} over`;
}

function pctColor(pct: number | null): string {
  if (pct === null) return "#888780";
  if (pct < 60) return "#e24b4a";
  if (pct < 75) return "#b26a00";
  return "#1a7f4b";
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
        <Cell>{utilisation.clientHours.toFixed(1)}</Cell>
        <Cell dim>{nonBillable.toFixed(1)}</Cell>
        <Cell dim>{utilisation.standardHours.toFixed(1)}</Cell>
        {/* The gap this whole column exists for: hours in neither the
            billable nor the non-billable figure because they were never
            entered. Red when time is missing, green when someone logged
            past their standard week. */}
        <Cell
          color={
            utilisation.unloggedHours > 0.05
              ? "#e24b4a"
              : utilisation.unloggedHours < -0.05
                ? "#1a7f4b"
                : "#888780"
          }
        >
          {fmtVariance(utilisation.unloggedHours)}
        </Cell>
        <Cell dim>{utilisation.billableSharePct !== null ? `${utilisation.billableSharePct}%` : "—"}</Cell>
        <Cell strong color={pctColor(utilisation.billableCapacityPct)}>
          {utilisation.billableCapacityPct !== null ? `${utilisation.billableCapacityPct}%` : "—"}
        </Cell>
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
  const [period, setPeriod] = useState<UtilisationPeriodKey | "custom" | "lastweek">("week");
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

  // "Last week" is just "this week" (startOfWeekMonday/periodBounds, via the
  // exported periodBounds helper) shifted back 7 days, so it stays a
  // calendar Monday-Sunday week computed the same way as the "This Week"
  // button rather than re-deriving the date math here.
  const lastWeekRange: DateRange = useMemo(() => {
    const thisWeek = periodBounds("week", new Date(today + "T00:00:00Z"));
    const start = new Date(thisWeek.start);
    start.setUTCDate(start.getUTCDate() - 7);
    const end = new Date(thisWeek.end);
    end.setUTCDate(end.getUTCDate() - 7);
    return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
  }, [today]);

  // A half-filled custom range would silently measure something nobody
  // asked for, so it falls back to the last fixed period until both ends
  // are set. Reversed dates are swapped rather than rejected.
  const customComplete = period === "custom" && Boolean(customFrom) && Boolean(customTo);
  const selection: PeriodSelection = useMemo(() => {
    if (period === "lastweek") return lastWeekRange;
    if (!customComplete) return period === "custom" ? "week" : period;
    return customFrom <= customTo
      ? { start: customFrom, end: customTo }
      : { start: customTo, end: customFrom };
  }, [customComplete, period, customFrom, customTo, lastWeekRange]);

  const utilisation = useMemo(
    () => computeWagesUtilisation(timesheets, practiceStaffIds, selection, today),
    [timesheets, practiceStaffIds, selection, today],
  );

  const byClient = useMemo(
    () => computeHoursByClient(timesheets, practiceStaffIds, selection, today, clientNamesMap),
    [timesheets, practiceStaffIds, selection, today, clientNamesMap],
  );

  const totalClientHours = byClient.reduce((acc, c) => acc + c.hours, 0);

  // Internal (YFD) -- per employee, a breakdown of the same four firm-wide
  // tiles above (Admin/Meetings, Leave, Idle, Unlogged) rather than one
  // merged "internal" number -- collapsing them loses exactly the
  // "who coded what to YFD" and "how much of the 38hr capacity is assumed
  // non-billable" visibility Steve asked to see per person. Reuses
  // computeWagesUtilisation's own fields (lib/workOverview.ts) so this
  // can't drift from the KPI cards or the By employee table.
  //
  // The "or if not registered" half of the original brief -- time logged
  // against a job XPM couldn't match to a real client -- still isn't
  // representable here: fetchXpmTimesheetsForPartner (lib/xpm.ts) already
  // drops those entries before they become an XpmTimesheet (clientId is
  // non-nullable there), so there's no unmatched-client bucket to show by
  // the time data reaches this page without changing that upstream fetch.
  const internalByStaff = useMemo(
    () =>
      staffOptions
        .map((s) => {
          const u = computeWagesUtilisation(timesheets, [s.id], selection, today);
          return {
            staff: s,
            adminHours: u.internalOtherHours,
            leaveHours: u.leaveHours,
            idleHours: u.idleHours,
            unloggedHours: u.unloggedHours,
          };
        })
        .sort((a, b) => a.unloggedHours + a.adminHours + a.leaveHours + a.idleHours < b.unloggedHours + b.adminHours + b.leaveHours + b.idleHours ? 1 : -1),
    [staffOptions, timesheets, selection, today],
  );
  const internalTotals = internalByStaff.reduce(
    (acc, r) => ({
      adminHours: acc.adminHours + r.adminHours,
      leaveHours: acc.leaveHours + r.leaveHours,
      idleHours: acc.idleHours + r.idleHours,
      unloggedHours: acc.unloggedHours + r.unloggedHours,
    }),
    { adminHours: 0, leaveHours: 0, idleHours: 0, unloggedHours: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Timesheets"
        subtitle={
          "Live from XPM · 38hr/week standard, counted to date, not prorated for part-timers · unlogged hours are treated as non-billable" +
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
        <PeriodButton label="Last week" active={period === "lastweek"} onClick={() => setPeriod("lastweek")} />
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
        {/* Row 1 -- three percentages off identical data, side by side on
            purpose. Comparing the wrong one against XPM's own Staff Time
            Summary Report wastes an afternoon. For 6 Jul - 2 Aug 2026 they
            read 77%, 81% and 65%. Definitions live in lib/workOverview.ts. */}
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
          label="Billable share (logged)"
          value={utilisation.billableSharePct !== null ? utilisation.billableSharePct + "%" : "—"}
          sub={
            utilisation.billableSharePct !== null
              ? utilisation.clientHours.toFixed(1) +
                " of " +
                utilisation.loggedHours.toFixed(1) +
                " hrs logged — ignores unlogged"
              : "No time logged"
          }
        />
        <KpiCard
          label="Billable utilisation"
          value={
            utilisation.billableCapacityPct !== null ? utilisation.billableCapacityPct + "%" : "—"
          }
          sub={
            utilisation.billableCapacityPct !== null
              ? utilisation.clientHours.toFixed(1) +
                " of " +
                Math.max(0, utilisation.standardHours - utilisation.leaveHours).toFixed(1) +
                " hrs capacity — unlogged counts against"
              : "No capacity in range"
          }
          valueColor={pctColor(utilisation.billableCapacityPct)}
        />

        {/* Rows 2-3 -- the four buckets that make up logged time, then the
            variance and the total, so the reconciliation is on the screen
            instead of being done by hand: client + admin + leave + idle =
            logged, and logged + unlogged = capacity. */}
        <KpiCard label="Client hours" value={utilisation.clientHours.toFixed(1) + " hrs"} sub="Billable" />
        <KpiCard
          label="Admin / meetings"
          value={utilisation.internalOtherHours.toFixed(1) + " hrs"}
          sub="Paid internal — non-billable, still utilised"
        />
        <KpiCard
          label="Leave"
          value={utilisation.leaveHours.toFixed(1) + " hrs"}
          sub="Taken out of capacity, not charged against it"
        />
        <KpiCard
          label="Idle"
          value={utilisation.idleHours.toFixed(1) + " hrs"}
          sub="Logged, non-billable, excluded from capacity used"
          valueColor={utilisation.idleHours > 0 ? "#e24b4a" : undefined}
        />
        <KpiCard
          label={utilisation.unloggedHours < 0 ? "Logged over standard" : "Unlogged (variance)"}
          value={Math.abs(utilisation.unloggedHours).toFixed(1) + " hrs"}
          sub={
            utilisation.standardHours.toFixed(1) +
            " capacity − " +
            utilisation.loggedHours.toFixed(1) +
            " logged" +
            (utilisation.unloggedHours > 0.05 ? " — treated as non-billable" : "")
          }
          valueColor={utilisation.unloggedHours > 0.05 ? "#e24b4a" : undefined}
        />
        <KpiCard
          label="Total logged"
          value={utilisation.loggedHours.toFixed(1) + " hrs"}
          sub="Client + admin + leave + idle"
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
            Hours · click a name for their client breakdown
          </div>
        </div>

        {/* Six numeric columns need labels. "% of logged" (XPM's own basis)
            answers "of the hours you entered, how much was billable" and
            says nothing about hours nobody logged -- someone can hit 100%
            here while still being well short on total hours entered, which
            read as contradictory next to Unlogged before the label spelled
            out "of logged". "% of capacity" counts unlogged time against
            the person instead; the two disagree by exactly the Unlogged
            column. */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "12px",
            padding: "0 0 6px",
            borderBottom: "0.5px solid #e1e0d9",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#888780",
          }}
        >
          <div style={{ width: "12px" }} />
          <div style={{ flex: 1 }}>Employee</div>
          <HeadCell>Billable</HeadCell>
          <HeadCell>Non-bill</HeadCell>
          <HeadCell>Capacity</HeadCell>
          <HeadCell>Unlogged</HeadCell>
          <HeadCell>% of logged</HeadCell>
          <HeadCell>% of capacity</HeadCell>
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

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.1rem 1.2rem",
          marginTop: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "8px" }}>
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>Internal (YFD)</div>
          <div style={{ fontSize: "11px", color: "#888780" }}>
            who coded what to YFD, and what's assumed non-billable per person
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "12px",
            padding: "0 0 6px",
            borderBottom: "0.5px solid #e1e0d9",
            fontSize: "10px",
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            color: "#888780",
          }}
        >
          <div style={{ flex: 1 }}>Employee</div>
          <HeadCell>Admin / meetings</HeadCell>
          <HeadCell>Leave</HeadCell>
          <HeadCell>Idle</HeadCell>
          <HeadCell>Unlogged</HeadCell>
        </div>

        {internalByStaff.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>No staff to show.</div>
        ) : (
          <div>
            {internalByStaff.map(({ staff, adminHours, leaveHours, idleHours, unloggedHours }) => (
              <div
                key={staff.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "10px 0",
                  borderBottom: "0.5px solid #e1e0d9",
                }}
              >
                <div style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#111111" }}>{staff.name}</div>
                <Cell>{adminHours.toFixed(1)}</Cell>
                <Cell>{leaveHours.toFixed(1)}</Cell>
                <Cell>{idleHours.toFixed(1)}</Cell>
                <Cell dim={unloggedHours <= 0}>{unloggedHours.toFixed(1)}</Cell>
              </div>
            ))}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0 0",
                fontSize: "13px",
                fontWeight: 600,
                color: "#111111",
              }}
            >
              <div style={{ flex: 1 }}>Total</div>
              <Cell>{internalTotals.adminHours.toFixed(1)}</Cell>
              <Cell>{internalTotals.leaveHours.toFixed(1)}</Cell>
              <Cell>{internalTotals.idleHours.toFixed(1)}</Cell>
              <Cell>{internalTotals.unloggedHours.toFixed(1)}</Cell>
            </div>
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
  return `${formatDate(range.start)} – ${formatDate(range.end)}`;
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
