"use client";

import { useEffect, useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import { computeHoursByClient, type DateRange } from "@/lib/workOverview";
import type { XpmTimesheet } from "@/types/xpm";

interface RevenueByClientPageClientProps {
  clients: { id: string; name: string }[];
  timesheets: XpmTimesheet[];
  staffIds: string[];
  clientNamesById: Record<string, string>;
  chargeRatePerHour: number;
  costRatePerHour: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// First of this month -> today, so the report opens already showing
// something instead of an empty picker (there are no fixed period buttons
// here -- unlike Clients/Timesheets, an arbitrary range is the whole point).
function defaultRange(today: string): DateRange {
  const d = new Date(today + "T00:00:00Z");
  const start = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1));
  return { start: start.toISOString().slice(0, 10), end: today };
}

function fmtCurrency(value: number): string {
  return `$${Math.round(value).toLocaleString("en-AU")}`;
}

interface ReportRow {
  id: string;
  name: string;
  hoursLogged: number;
  revenue: number;
  hoursBudgeted: number;
  // Cost of the hours actually worked, for the selected range as picked --
  // deliberately not normalised to "a month" (the range is fluid, so there's
  // no fixed calendar unit to extrapolate to); same figure marginDollar is
  // measured against.
  rangeCost: number;
  avgHourIncome: number | null;
  marginDollar: number;
  marginPct: number | null;
  deltaPct: number | null;
}

type SortKey = keyof Omit<ReportRow, "id">;

// Nulls (a client with income logged but zero hours, or vice versa) sort to
// the end regardless of direction -- "unknown" isn't meaningfully high or
// low, and letting it flip to the top on a descending sort would read as
// the best/worst row in the table.
function sortRows(rows: ReportRow[], sort: { key: SortKey; dir: 1 | -1 }): ReportRow[] {
  return [...rows].sort((a, b) => {
    const av = a[sort.key];
    const bv = b[sort.key];
    if (av === null && bv === null) return 0;
    if (av === null) return 1;
    if (bv === null) return -1;
    if (typeof av === "string" || typeof bv === "string") {
      return String(av).localeCompare(String(bv)) * sort.dir;
    }
    return ((av as number) - (bv as number)) * sort.dir;
  });
}

export default function RevenueByClientPageClient({
  clients,
  timesheets,
  staffIds,
  clientNamesById,
  chargeRatePerHour,
  costRatePerHour,
}: RevenueByClientPageClientProps) {
  const today = todayIso();
  const initialRange = useMemo(() => defaultRange(today), [today]);
  const [customFrom, setCustomFrom] = useState(initialRange.start);
  const [customTo, setCustomTo] = useState(initialRange.end);

  // Both the charge rate ($/hr a client is assumed to be paying, used to
  // turn invoiced revenue into an implied "hours budgeted" figure -- there's
  // no real per-client budget stored anywhere) and the cost rate ($/hr of
  // staff time, used for the cost/income columns -- no per-staff cost is
  // stored anywhere either) are single firm-wide numbers from Settings,
  // editable right here since this is the only place they're used.
  const [chargeRate, setChargeRate] = useState(chargeRatePerHour);
  const [costRate, setCostRate] = useState(costRatePerHour);
  const [savingRates, setSavingRates] = useState(false);
  const [rateError, setRateError] = useState<string | null>(null);

  const [revenueByName, setRevenueByName] = useState<Record<string, number>>({});
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueError, setRevenueError] = useState<string | null>(null);

  const clientNamesMap = useMemo(() => new Map(Object.entries(clientNamesById)), [clientNamesById]);

  const complete = Boolean(customFrom) && Boolean(customTo);
  const range: DateRange | null = useMemo(() => {
    if (!complete) return null;
    return customFrom <= customTo ? { start: customFrom, end: customTo } : { start: customTo, end: customFrom };
  }, [complete, customFrom, customTo]);

  const hoursByName = useMemo(() => {
    if (!range) return new Map<string, number>();
    const byClient = computeHoursByClient(timesheets, staffIds, range, today, clientNamesMap);
    return new Map(byClient.map((c) => [c.clientName, c.hours]));
  }, [range, timesheets, staffIds, clientNamesMap, today]);

  useEffect(() => {
    if (!range) return;
    let cancelled = false;

    const load = async () => {
      setRevenueLoading(true);
      setRevenueError(null);
      try {
        const res = await fetch(`/api/xero-accounting/revenue-by-client?from=${range.start}&to=${range.end}`);
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error ?? "Failed to load revenue");
        const byName: Record<string, number> = {};
        for (const { clientName, revenue } of data.revenue ?? []) {
          byName[clientName] = revenue;
        }
        setRevenueByName(byName);
      } catch (err) {
        if (cancelled) return;
        setRevenueByName({});
        setRevenueError(err instanceof Error ? err.message : "Failed to load revenue");
      } finally {
        if (!cancelled) setRevenueLoading(false);
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [range]);

  // The margin baked into the rate assumptions themselves -- e.g. $80
  // charge / $35 cost implies every hour "should" run at 56.3% margin.
  // Same number for every client (it's just the two settings), shown once
  // near the rate fields and used as the benchmark each row's actual
  // margin is compared against (the Delta column).
  const expectedMarginPct = chargeRate > 0 ? ((chargeRate - costRate) / chargeRate) * 100 : null;

  const unsortedRows = useMemo(() => {
    return clients
      .map((c) => {
        const hoursLogged = hoursByName.get(c.name) ?? 0;
        const revenue = revenueByName[c.name] ?? 0;
        const hoursBudgeted = chargeRate > 0 ? revenue / chargeRate : 0;
        const avgHourIncome = hoursLogged > 0 ? revenue / hoursLogged : null;
        // Actual cost of the hours actually worked (not the budgeted ones)
        // over the selected range -- this is what a client's real margin is
        // measured against.
        const rangeCost = hoursLogged * costRate;
        const marginDollar = revenue - rangeCost;
        const marginPct = revenue > 0 ? (marginDollar / revenue) * 100 : null;
        const deltaPct = marginPct !== null && expectedMarginPct !== null ? marginPct - expectedMarginPct : null;
        return {
          id: c.id,
          name: c.name,
          hoursLogged,
          revenue,
          hoursBudgeted,
          rangeCost,
          avgHourIncome,
          marginDollar,
          marginPct,
          deltaPct,
        };
      })
      .filter((r) => r.hoursLogged > 0 || r.revenue > 0);
  }, [clients, hoursByName, revenueByName, chargeRate, costRate, expectedMarginPct]);

  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "hoursLogged", dir: -1 });

  const rows = useMemo(() => sortRows(unsortedRows, sort), [unsortedRows, sort]);

  function toggleSort(key: SortKey) {
    setSort((prev) => (prev.key === key ? { key, dir: (prev.dir * -1) as 1 | -1 } : { key, dir: -1 }));
  }

  async function handleSaveRates() {
    setSavingRates(true);
    setRateError(null);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chargeRatePerHour: chargeRate, costRatePerHour: costRate }),
      });
      if (!res.ok) throw new Error("Failed to save rates");
    } catch (err) {
      setRateError(err instanceof Error ? err.message : "Failed to save rates");
    } finally {
      setSavingRates(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Revenue by Client"
        subtitle="Hours logged (XPM) vs. hours budgeted (invoiced revenue ÷ charge rate), plus cost for the selected period and average hour cost vs. income. Income is real invoiced revenue from Xero Accounting, matched to each client by exact name."
      />

      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          justifyContent: "space-between",
          gap: "18px",
          padding: "14px 0",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
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
          {!complete ? (
            <span style={{ fontSize: "11px", color: "#888780" }}>Pick both dates.</span>
          ) : revenueLoading ? (
            <span style={{ fontSize: "11px", color: "#888780" }}>Loading revenue…</span>
          ) : revenueError ? (
            <span style={{ fontSize: "11px", color: "#A32D2D" }}>Revenue unavailable</span>
          ) : null}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <RateField label="Charge rate $/hr" value={chargeRate} onChange={setChargeRate} />
          <RateField label="Cost rate $/hr" value={costRate} onChange={setCostRate} />
          <button type="button" onClick={handleSaveRates} disabled={savingRates} style={saveButtonStyle}>
            {savingRates ? "Saving…" : "Save rates"}
          </button>
          <span style={{ fontSize: "11px", color: "#888780" }}>
            Expected margin: {expectedMarginPct !== null ? `${expectedMarginPct.toFixed(1)}%` : "—"}
          </span>
        </div>
      </div>

      {rateError ? (
        <div style={{ fontSize: "12px", color: "#A32D2D", marginBottom: "12px" }}>{rateError}</div>
      ) : null}

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.1rem 1.2rem",
          overflowX: "auto",
        }}
      >
        <div style={{ minWidth: "980px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "12px",
              padding: "0 0 6px",
              borderBottom: "0.5px solid #e1e0d9",
            }}
          >
            {/* Δ vs expected / Margin % / Margin $ lead the table -- these
                are the "at a glance, which clients need attention" columns,
                so they sit right next to the name rather than after six
                supporting-detail columns someone would have to scroll to. */}
            <SortHeadCell sortKey="name" sort={sort} onSort={toggleSort} flex>
              Client
            </SortHeadCell>
            <SortHeadCell sortKey="deltaPct" sort={sort} onSort={toggleSort}>
              Δ vs expected
            </SortHeadCell>
            <SortHeadCell sortKey="marginPct" sort={sort} onSort={toggleSort}>
              Margin %
            </SortHeadCell>
            <SortHeadCell sortKey="marginDollar" sort={sort} onSort={toggleSort}>
              Margin $
            </SortHeadCell>
            <SortHeadCell sortKey="hoursLogged" sort={sort} onSort={toggleSort}>
              Hours logged
            </SortHeadCell>
            <SortHeadCell sortKey="hoursBudgeted" sort={sort} onSort={toggleSort}>
              Hours budgeted
            </SortHeadCell>
            <SortHeadCell sortKey="revenue" sort={sort} onSort={toggleSort}>
              Income
            </SortHeadCell>
            <SortHeadCell sortKey="rangeCost" sort={sort} onSort={toggleSort}>
              Cost (period)
            </SortHeadCell>
            <ReportHeadCell>Avg hour cost</ReportHeadCell>
            <SortHeadCell sortKey="avgHourIncome" sort={sort} onSort={toggleSort}>
              Avg hour income
            </SortHeadCell>
          </div>

          {rows.length === 0 ? (
            <div style={{ fontSize: "12px", color: "#888780", padding: "12px 0" }}>
              No hours or invoiced revenue for this range.
            </div>
          ) : (
            rows.map((r) => (
              <div
                key={r.id}
                style={{ display: "flex", alignItems: "center", gap: "12px", padding: "10px 0", borderBottom: "0.5px solid #e1e0d9" }}
              >
                <div style={{ flex: 1, fontSize: "13px", fontWeight: 500, color: "#111111" }}>{r.name}</div>
                <ReportCell strong color={deltaColor(r.deltaPct)}>
                  {r.deltaPct !== null ? `${r.deltaPct > 0 ? "+" : ""}${r.deltaPct.toFixed(1)}pp` : "—"}
                </ReportCell>
                <ReportCell color={r.marginPct !== null && r.marginPct < 0 ? "#e24b4a" : undefined}>
                  {r.marginPct !== null ? `${r.marginPct.toFixed(1)}%` : "—"}
                </ReportCell>
                <ReportCell color={r.marginDollar < 0 ? "#e24b4a" : undefined}>{fmtCurrency(r.marginDollar)}</ReportCell>
                <ReportCell>{r.hoursLogged.toFixed(1)}</ReportCell>
                <ReportCell>{r.hoursBudgeted.toFixed(1)}</ReportCell>
                <ReportCell>{fmtCurrency(r.revenue)}</ReportCell>
                <ReportCell>{fmtCurrency(r.rangeCost)}</ReportCell>
                <ReportCell dim>{fmtCurrency(costRate)}</ReportCell>
                <ReportCell strong>{r.avgHourIncome !== null ? fmtCurrency(r.avgHourIncome) : "—"}</ReportCell>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// Green when a client is running above the rate-implied benchmark margin
// (more profitable than assumed), red when below (less profitable -- often
// the sign of scope creep, since hours logged outrunning what's invoiced
// eats directly into this).
function deltaColor(deltaPct: number | null): string | undefined {
  if (deltaPct === null) return undefined;
  if (deltaPct > 1) return "#1a7f4b";
  if (deltaPct < -1) return "#e24b4a";
  return undefined;
}

function RateField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <label style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "#888780" }}>
      {label}
      <input
        type="number"
        min={0}
        step="0.01"
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
        style={{ ...dateInputStyle, width: "70px" }}
      />
    </label>
  );
}

function ReportHeadCell({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        width: "100px",
        flexShrink: 0,
        textAlign: "right",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: "#888780",
      }}
    >
      {children}
    </div>
  );
}

function SortHeadCell({
  sortKey,
  sort,
  onSort,
  flex,
  children,
}: {
  sortKey: SortKey;
  sort: { key: SortKey; dir: 1 | -1 };
  onSort: (key: SortKey) => void;
  flex?: boolean;
  children: React.ReactNode;
}) {
  const active = sort.key === sortKey;
  return (
    <button
      type="button"
      onClick={() => onSort(sortKey)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: flex ? "flex-start" : "flex-end",
        gap: "4px",
        flex: flex ? 1 : undefined,
        width: flex ? undefined : "100px",
        flexShrink: 0,
        background: "none",
        border: "none",
        padding: 0,
        cursor: "pointer",
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.04em",
        color: active ? "#2a78d6" : "#888780",
      }}
    >
      {children}
      <span style={{ fontSize: "9px", visibility: active ? "visible" : "hidden" }}>
        {sort.dir === 1 ? "▲" : "▼"}
      </span>
    </button>
  );
}

function ReportCell({
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
        width: "100px",
        flexShrink: 0,
        textAlign: "right",
        fontSize: "13px",
        fontWeight: strong ? 600 : 500,
        color: color ?? (dim ? "#888780" : "#111111"),
      }}
    >
      {children}
    </div>
  );
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

const saveButtonStyle: React.CSSProperties = {
  fontSize: "12px",
  fontWeight: 500,
  padding: "7px 14px",
  borderRadius: "999px",
  background: "#111111",
  color: "white",
  border: "none",
  cursor: "pointer",
};
