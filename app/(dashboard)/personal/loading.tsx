import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/dashboard/Skeleton";

export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div style={{ marginBottom: "14px" }}>
        <CardGridSkeleton count={3} columns={3} lines={4} />
      </div>
      <CardGridSkeleton count={2} columns={2} lines={5} />
    </div>
  );
}
