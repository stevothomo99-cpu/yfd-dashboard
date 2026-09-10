import { PageHeaderSkeleton, TableSkeleton } from "@/components/dashboard/Skeleton";

// Mirrors the ranked staff leaderboard table.
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={8} />
    </div>
  );
}
