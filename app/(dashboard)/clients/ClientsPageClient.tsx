"use client";

import { useMemo, useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import ClientTile, { statusOf, type TileStatus } from "@/components/dashboard/ClientTile";
import TileDrawer from "@/components/dashboard/TileDrawer";
import { computeHoursByClient, UTILISATION_PERIODS, type UtilisationPeriodKey } from "@/lib/workOverview";
import type { ClientSummary } from "@/types/workflow";
import type { XpmTimesheet } from "@/types/xpm";

type Filter = "all" | TileStatus;

const FILTER_ORDER: Record<TileStatus, number> = {
  overdue: 0,
  "in-progress": 1,
  "all-clear": 2,
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "overdue", label: "Overdue" },
  { value: "in-progress", label: "In progress" },
  { value: "all-clear", label: "All clear" },
];

interface StaffOption {
  id: string;
  name: string;
}

interface ClientsPageClientProps {
  tiles: ClientSummary[];
  staffOptions: StaffOption[];
  timesheets: XpmTimesheet[];
  staffIds: string[];
  clientNamesById: Record<string, string>;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function ClientsPageClient({
  tiles: allTiles,
  staffOptions,
  timesheets,
  staffIds,
  clientNamesById,
}: ClientsPageClientProps) {
  const [filter, setFilter] = useState<Filter>("all");
  const [search, setSearch] = useState("");
  const [staffId, setStaffId] = useState("");
  const [activeTile, setActiveTile] = useState<ClientSummary | null>(null);
  const [hoursPeriod, setHoursPeriod] = useState<UtilisationPeriodKey>("fy");

  const clientNamesMap = useMemo(() => new Map(Object.entries(clientNamesById)), [clientNamesById]);

  const hoursByClientId = useMemo(() => {
    const byClient = computeHoursByClient(timesheets, staffIds, hoursPeriod, todayIso(), clientNamesMap);
    return Object.fromEntries(byClient.map((c) => [c.clientId, c.hours]));
  }, [timesheets, staffIds, hoursPeriod, clientNamesMap]);

  const hoursPeriodLabel = UTILISATION_PERIODS.find((p) => p.value === hoursPeriod)?.label ?? "";

  // Only offer staff who actually manage at least one client -- no point
  // listing someone with an empty result every time.
  const availableStaffOptions = useMemo(() => {
    const managingIds = new Set(allTiles.flatMap((t) => t.managerIds));
    return staffOptions.filter((s) => managingIds.has(s.id));
  }, [allTiles, staffOptions]);

  const tiles = useMemo(() => {
    return allTiles
      .filter((t) => {
        if (filter !== "all" && statusOf(t) !== filter) return false;
        if (staffId && !t.managerIds.includes(staffId)) return false;
        if (search.trim() && !t.name.toLowerCase().includes(search.trim().toLowerCase())) return false;
        return true;
      })
      .sort((a, b) => FILTER_ORDER[statusOf(a)] - FILTER_ORDER[statusOf(b)] || a.name.localeCompare(b.name));
  }, [allTiles, filter, staffId, search]);

  const totalHoursLogged = useMemo(
    () => tiles.reduce((acc, t) => acc + (t.xpmClientId ? hoursByClientId[t.xpmClientId] ?? 0 : 0), 0),
    [tiles, hoursByClientId],
  );

  // Destination-client picker for the drawer's "Copy task" / "Apply
  // template" actions -- every client in the practice, not just the ones
  // matching the current filter/search, so those actions aren't limited by
  // whatever the grid happens to be showing right now.
  const allClientOptions = useMemo(
    () => allTiles.map((t) => ({ id: t.id, name: t.name })).sort((a, b) => a.name.localeCompare(b.name)),
    [allTiles],
  );

  return (
    <div>
      <PageHeader title="Clients" subtitle="Tile view · sorted by status · click a tile to drill in" />

      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: "18px", padding: "0 0 14px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap" }}>
          <SummaryStat label="Clients" value={tiles.length.toString()} />
          <SummaryStat label={`Hours logged (${hoursPeriodLabel})`} value={totalHoursLogged.toFixed(1)} />
        </div>
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {UTILISATION_PERIODS.map((p) => {
            const active = p.value === hoursPeriod;
            return (
              <button
                key={p.value}
                type="button"
                onClick={() => setHoursPeriod(p.value)}
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
      </div>

      <div style={{ display: "flex", gap: "8px", alignItems: "center", padding: "0 0 18px", flexWrap: "wrap" }}>
        {FILTERS.map((f) => {
          const active = f.value === filter;
          return (
            <button
              key={f.value}
              type="button"
              onClick={() => setFilter(f.value)}
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
              {f.label}
            </button>
          );
        })}
        <select
          value={staffId}
          onChange={(e) => setStaffId(e.target.value)}
          style={{
            marginLeft: "8px",
            fontSize: "12px",
            padding: "7px 10px",
            borderRadius: "8px",
            border: "0.5px solid #e1e0d9",
            background: "white",
            color: staffId ? "#111111" : "#888780",
            outline: "none",
          }}
        >
          <option value="">All staff</option>
          {availableStaffOptions.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients…"
          style={{
            marginLeft: "8px",
            fontSize: "12px",
            padding: "7px 12px",
            borderRadius: "8px",
            border: "0.5px solid #e1e0d9",
            background: "white",
            color: "#111111",
            outline: "none",
            minWidth: "200px",
          }}
        />
      </div>

      {tiles.length === 0 ? (
        <div
          style={{
            background: "white",
            border: "0.5px solid #e1e0d9",
            borderRadius: "14px",
            padding: "48px 24px",
            textAlign: "center",
            color: "#888780",
            fontSize: "13px",
          }}
        >
          No clients match the current filters.
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
          {tiles.map((t) => (
            <ClientTile
              key={t.id}
              tile={t}
              hoursLogged={t.xpmClientId ? hoursByClientId[t.xpmClientId] : undefined}
              hoursPeriodLabel={hoursPeriodLabel}
              onClick={() => setActiveTile(t)}
            />
          ))}
        </div>
      )}

      <TileDrawer tile={activeTile} onClose={() => setActiveTile(null)} allClients={allClientOptions} />
    </div>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: "10px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em" }}>
        {label}
      </div>
      <div style={{ fontSize: "20px", fontWeight: 500, color: "#111111", marginTop: "2px" }}>{value}</div>
    </div>
  );
}
