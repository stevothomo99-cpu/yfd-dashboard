import { PageHeaderSkeleton, CardGridSkeleton, CardSkeleton } from "@/components/dashboard/Skeleton";

// Mirrors DashboardPage: To-Do section above a three-tile row (BAS status,
// overdue work items, utilisation). The utilisation tile is the slow one --
// it waits on XPM timesheets -- so this fallback is what the user looks at
// while that resolves.
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div style={{ marginBottom: "14px" }}>
        <CardSkeleton lines={2} />
      </div>
      <CardGridSkeleton count={3} columns={3} lines={4} />
    </div>
  );
}
