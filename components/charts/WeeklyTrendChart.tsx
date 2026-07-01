import PendingXpmNotice from "@/components/dashboard/PendingXpmNotice";

export default function WeeklyTrendChart() {
  return (
    <PendingXpmNotice
      title="📊 Weekly trend — hrs vs available"
      note="needs XPM timesheet history to chart billable/non-billable hours against availability over time."
    />
  );
}
