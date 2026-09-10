import { PageHeaderSkeleton, CardGridSkeleton, TableSkeleton } from "@/components/dashboard/Skeleton";

// Mirrors the KPI strip above the BAS work-item table.
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div style={{ marginBottom: "14px" }}>
        <CardGridSkeleton count={4} columns={4} lines={1} />
      </div>
      <TableSkeleton rows={10} />
    </div>
  );
}
