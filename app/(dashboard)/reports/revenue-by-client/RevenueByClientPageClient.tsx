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

// Average days-per-month across a Gregorian 4-year cycle (365.25 * 4 / 48) --
// close enough for "how many months does this range span" without the edge
// cases of counting actual calendar months crossed.
const AVG_DAYS_PER_MONTH = 30.44;

function monthsInRange(range: DateRange): number {
  const start = new Date(range.start + "T00:00:00Z");
  const end = new Date(range.end + "T00:00:00Z");
  const days = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(days, 1) / AVG_DAYS_PER_MONTH;
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

  const months = range ? monthsInRange(range) : 1;

  const rows = useMemo(() => {
    return clients
      .map((c) => {
        const hoursLogged = hoursByName.get(c.name) ?? 0;
        const revenue = revenueByName[c.name] ?? 0;
        const hoursBudgeted = chargeRate > 0 ? revenue / chargeRate : 0;
        const avgMonthlyHours = hoursLogged / months;
        const avgMonthlyCost = avgMonthlyHours * costRate;
        const avgHourIncome = hoursLogged > 0 ? revenue / hoursLogged : null;
        return { id: c.id, name: c.name, hoursLogged, hoursBudgeted, avgMonthlyCost, avgHourIncome, revenue };
      })
      .filter((r) => r.hoursLogged > 0 || r.revenue > 0)
      .sort((a, b) => b.hoursLogged - a.hoursLogged);
  }, [clients, hoursByName, revenueByName, chargeRate, costRate, months]);

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
        subtitle="Hours logged (XPM) vs. hours budgeted (invoiced revenue ÷ charge rate), plus average monthly cost and average hour cost vs. income. Income is real invoiced revenue from Xero Accounting, matched to each client by exact name."
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
        </div>
      </div>

      {rateError ? (
        <div style={{ fontSize: "12px", color: "#A32D2D", marginBottom: "12px" }}>{rateError}</div>
      ) : null}

      <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", padding: "1.1rem 1.2rem" }}>
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
          <div style={{ flex: 1 }}>Client</div>
          <ReportHeadCell>Hours logged</ReportHeadCell>
          <ReportHeadCell>Income</ReportHeadCell>
          <ReportHeadCell>Hours budgeted</ReportHeadCell>
          <ReportHeadCell>Avg monthly cost</ReportHeadCell>
          <ReportHeadCell>Avg hour cost</ReportHeadCell>
          <ReportHeadCell>Avg hour income</ReportHeadCell>
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
              <ReportCell>{r.hoursLogged.toFixed(1)}</ReportCell>
              <ReportCell>{fmtCurrency(r.revenue)}</ReportCell>
              <ReportCell>{r.hoursBudgeted.toFixed(1)}</ReportCell>
              <ReportCell>{fmtCurrency(r.avgMonthlyCost)}</ReportCell>
              <ReportCell dim>{fmtCurrency(costRate)}</ReportCell>
              <ReportCell strong>{r.avgHourIncome !== null ? fmtCurrency(r.avgHourIncome) : "—"}</ReportCell>
            </div>
          ))
        )}
      </div>
    </div>
  );
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
  return <div style={{ width: "112px", textAlign: "right" }}>{children}</div>;
}

function ReportCell({
  children,
  dim,
  strong,
}: {
  children: React.ReactNode;
  dim?: boolean;
  strong?: boolean;
}) {
  return (
    <div
      style={{
        width: "112px",
        textAlign: "right",
        fontSize: "13px",
        fontWeight: strong ? 600 : 500,
        color: dim ? "#888780" : "#111111",
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
