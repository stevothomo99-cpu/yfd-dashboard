import { PageHeaderSkeleton, TableSkeleton } from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <TableSkeleton rows={12} />
    </div>
  );
}
