import { auth } from "@/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import KpiCard from "@/components/dashboard/KpiCard";
import { getSettings } from "@/lib/settings";
import { getStaffByEmail, getWorkBoardForStaff } from "@/lib/workflow";
import { computeUtilisation, computeWorkOverviewCounts, type UtilisationSummary } from "@/lib/workOverview";
import { fetchXpmClientsForPartner, getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Per-user "Work" overview -- distinct from /personal (company-wide
// Business KPIs, CEO-facing, unchanged) and /my-work (the full work-item
// table). Starts with three tiles: BAS status, overdue work items, and
// billable-hours utilisation (week/month/YTD) -- more can follow.
export default async function DashboardPage() {
  const session = await auth();
  const staff = session?.user?.email ? await getStaffByEmail(session.user.email) : null;

  if (!staff) {
    return (
      <div>
        <PageHeader title="Dashboard" subtitle="Your work at a glance" />
        <EmptyState message="No staff record is linked to your login email yet. Ask an admin to add one with a matching email so this can be resolved." />
      </div>
    );
  }

  const today = todayIso();
  const board = await getWorkBoardForStaff(staff);
  const counts = computeWorkOverviewCounts(board, today);

  const { utilisation, utilisationMessage } = await loadUtilisation(staff.xpmStaffId, today);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        subtitle={
          staff.role === "Partner"
            ? "Practice-wide overview, scoped by Partner > Manager > Staff"
            : staff.role === "Manager"
              ? "Your team's overview"
              : "Your work at a glance"
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: "14px" }}>
        <KpiCard
          label="BAS status"
          value={String(counts.basOpenCount)}
          valueColor={counts.basOverdueCount > 0 ? "#e24b4a" : undefined}
          sub={counts.basOverdueCount > 0 ? `${counts.basOverdueCount} overdue` : "None overdue"}
        />
        <KpiCard
          label="Overdue work items"
          value={String(counts.overdueCount)}
          valueColor={counts.overdueCount > 0 ? "#e24b4a" : undefined}
          sub="Past due date"
        />
        <UtilisationTile summary={utilisation} message={utilisationMessage} />
      </div>
    </div>
  );
}

async function loadUtilisation(
  xpmStaffId: string | null,
  today: string
): Promise<{ utilisation: UtilisationSummary | null; utilisationMessage: string | null }> {
  if (!xpmStaffId) {
    return { utilisation: null, utilisationMessage: "Not linked to an XPM staff record yet." };
  }
  if (!isXpmConfigured()) {
    return { utilisation: null, utilisationMessage: "XPM isn't configured (XPM_CLIENT_ID etc. not set)." };
  }

  const settings = await getSettings();
  if (!settings.partnerName) {
    return { utilisation: null, utilisationMessage: "Set a Partner name in Settings to sync XPM timesheets." };
  }

  try {
    const [timesheets, clients] = await Promise.all([
      getXpmTimesheets(settings.partnerName),
      fetchXpmClientsForPartner(settings.partnerName),
    ]);
    const clientNamesById = new Map(clients.map((c) => [c.id, c.name]));
    return {
      utilisation: computeUtilisation(timesheets, clientNamesById, xpmStaffId, today),
      utilisationMessage: null,
    };
  } catch (err) {
    return {
      utilisation: null,
      utilisationMessage: err instanceof Error ? err.message : "Failed to load timesheets.",
    };
  }
}

function UtilisationTile({
  summary,
  message,
}: {
  summary: UtilisationSummary | null;
  message: string | null;
}) {
  return (
    <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", padding: "1.1rem 1.2rem" }}>
      <div
        style={{
          fontSize: "10px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "10px",
        }}
      >
        Utilisation
      </div>

      {!summary ? (
        <div style={{ fontSize: "12px", color: "#888780" }}>{message}</div>
      ) : (
        <div style={{ display: "flex", gap: "12px" }}>
          <UtilisationPeriodStat label="Week" period={summary.week} />
          <UtilisationPeriodStat label="Month" period={summary.month} />
          <UtilisationPeriodStat label="YTD" period={summary.ytd} />
        </div>
      )}
    </div>
  );
}

function UtilisationPeriodStat({ label, period }: { label: string; period: UtilisationSummary["week"] }) {
  return (
    <div style={{ flex: 1 }}>
      <div style={{ fontSize: "20px", fontWeight: 500, color: "#111111", lineHeight: 1 }}>{period.pct}%</div>
      <div style={{ fontSize: "11px", color: "#888780", marginTop: "4px" }}>
        {label} · {period.billableHours.toFixed(1)}/{period.totalHours.toFixed(1)}h
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
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
      {message}
    </div>
  );
}
