import KpiStrip from "@/components/dashboard/KpiStrip";
import TopPerformers from "@/components/dashboard/TopPerformers";
import BillableChart from "@/components/charts/BillableChart";
import WeeklyTrendChart from "@/components/charts/WeeklyTrendChart";
import OverdueTasks from "@/components/dashboard/OverdueTasks";
import BasSnapshot from "@/components/dashboard/BasSnapshot";
import RevenueSnapshot from "@/components/dashboard/RevenueSnapshot";

export default function DashboardPage() {
  return (
    <div>
      <KpiStrip />

      {/* Row 1 — 3 equal columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "14px",
        marginBottom: "14px",
      }}>
        <TopPerformers />
        <BillableChart />
        <WeeklyTrendChart />
      </div>

      {/* Row 2 — 3 equal columns */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gap: "14px",
      }}>
        <OverdueTasks />
        <BasSnapshot />
        <RevenueSnapshot />
      </div>
    </div>
  );
}
