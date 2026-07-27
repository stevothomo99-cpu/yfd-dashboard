import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/dashboard/Skeleton";

// Mirrors the Clients tile grid (one tile per client, four across).
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <div style={{ marginBottom: "14px" }}>
        <CardGridSkeleton count={4} columns={4} lines={1} />
      </div>
      <CardGridSkeleton count={8} columns={4} lines={2} />
    </div>
  );
}
