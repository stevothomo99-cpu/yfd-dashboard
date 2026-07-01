import KpiStrip from "@/components/dashboard/KpiStrip";
import TopPerformers from "@/components/dashboard/TopPerformers";
import BillableChart from "@/components/charts/BillableChart";
import WeeklyTrendChart from "@/components/charts/WeeklyTrendChart";
import OverdueTasks from "@/components/dashboard/OverdueTasks";
import BasSnapshot from "@/components/dashboard/BasSnapshot";
import RevenueSnapshot from "@/components/dashboard/RevenueSnapshot";
import { getSettings } from "@/lib/settings";
import { loadDashboardKarbonData } from "@/lib/dashboardData";

export default async function DashboardPage() {
  const settings = await getSettings();
  const data = await loadDashboardKarbonData(settings.excludedStaffIds);

  const tasksOverdue = data.tasks.filter((t) => t.isOverdue).length;
  const basLodged = data.basWorkItems.filter((w) => w.status === "complete").length;
  const basTotal = data.basWorkItems.length;

  return (
    <div>
      {data.mode === "mock" ? (
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
          Showing mock data — {data.message ?? "Karbon is not configured."}
        </div>
      ) : null}

      <KpiStrip tasksOverdue={tasksOverdue} basLodged={basLodged} basTotal={basTotal} />

      {/* Row 1 — 3 equal columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "14px",
        marginBottom: "14px",
      }}>
        <TopPerformers staff={data.stats} />
        <BillableChart />
        <WeeklyTrendChart />
      </div>

      {/* Row 2 — 3 equal columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "14px",
      }}>
        <OverdueTasks tasks={data.tasks} />
        <BasSnapshot workItems={data.basWorkItems} />
        <RevenueSnapshot />
      </div>
    </div>
  );
}
