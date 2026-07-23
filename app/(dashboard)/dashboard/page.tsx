import { auth } from "@/auth";
import PageHeader from "@/components/dashboard/PageHeader";
import WorkItemMiniTable from "@/components/dashboard/WorkItemMiniTable";
import UtilisationTile from "@/components/dashboard/UtilisationTile";
import { getSettings } from "@/lib/settings";
import { getStaffByEmail, getWorkBoardForStaff } from "@/lib/workflow";
import {
  computeWagesUtilisation,
  getBasTasks,
  getOverdueTasks,
  UTILISATION_PERIODS,
  type UtilisationPeriodKey,
  type WagesUtilisationResult,
} from "@/lib/workOverview";
import { getXpmTimesheets, isXpmConfigured } from "@/lib/xpm";

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

// Per-user "Work" overview -- distinct from /personal (company-wide
// Business KPIs, CEO-facing, unchanged) and /my-work (the full work-item
// table). Starts with three tiles: BAS status, overdue work items (each
// with a mini table of the actual tasks behind the number), and billable
// utilisation (week/month/YTD, one period at a time via a time slicer).
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
  const overdueTasks = getOverdueTasks(board, today);
  const basTasks = getBasTasks(board, today);
  const basOverdueCount = basTasks.filter((t) => t.dueDate && t.dueDate < today).length;

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
        <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", padding: "1.1rem 1.2rem" }}>
          <TileLabel>BAS status</TileLabel>
          <TileValue value={basTasks.length} color={basOverdueCount > 0 ? "#e24b4a" : undefined} />
          <TileSub>{basOverdueCount > 0 ? `${basOverdueCount} overdue` : "None overdue"}</TileSub>
          <WorkItemMiniTable tasks={basTasks} today={today} emptyLabel="No open BAS/IAS work items." />
        </div>

        <div style={{ background: "white", border: "0.5px solid #e1e0d9", borderRadius: "14px", padding: "1.1rem 1.2rem" }}>
          <TileLabel>Overdue work items</TileLabel>
          <TileValue value={overdueTasks.length} color={overdueTasks.length > 0 ? "#e24b4a" : undefined} />
          <TileSub>Past due date</TileSub>
          <WorkItemMiniTable tasks={overdueTasks} today={today} emptyLabel="Nothing overdue." />
        </div>

        <UtilisationTile summary={utilisation} message={utilisationMessage} />
      </div>
    </div>
  );
}

async function loadUtilisation(
  xpmStaffId: string | null,
  today: string
): Promise<{
  utilisation: Record<UtilisationPeriodKey, WagesUtilisationResult> | null;
  utilisationMessage: string | null;
}> {
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
    const timesheets = await getXpmTimesheets(settings.partnerName);
    const utilisation = Object.fromEntries(
      UTILISATION_PERIODS.map((p) => [
        p.value,
        computeWagesUtilisation(timesheets, [xpmStaffId], p.value, today),
      ]),
    ) as Record<UtilisationPeriodKey, WagesUtilisationResult>;
    return { utilisation, utilisationMessage: null };
  } catch (err) {
    return {
      utilisation: null,
      utilisationMessage: err instanceof Error ? err.message : "Failed to load timesheets.",
    };
  }
}

function TileLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: "10px", fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "8px" }}>
      {children}
    </div>
  );
}

function TileValue({ value, color }: { value: number; color?: string }) {
  return <div style={{ fontSize: "26px", fontWeight: 500, color: color ?? "#111111", lineHeight: 1 }}>{value}</div>;
}

function TileSub({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: "12px", color: "#888780", marginTop: "6px" }}>{children}</div>;
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
