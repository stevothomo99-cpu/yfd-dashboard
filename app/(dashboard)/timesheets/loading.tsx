import { PageHeaderSkeleton, CardGridSkeleton, TableSkeleton } from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div style={{ marginBottom: "14px" }}>
        <CardGridSkeleton count={3} columns={3} lines={1} />
      </div>
      <TableSkeleton rows={10} />
    </div>
  );
}
