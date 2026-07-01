import PendingXpmNotice from "@/components/dashboard/PendingXpmNotice";

export default function BillableChart() {
  return (
    <PendingXpmNotice
      title="🕐 Billable vs non-billable (week)"
      note="needs XPM timesheet data to compute billable/non-billable hours per staff member."
    />
  );
}
