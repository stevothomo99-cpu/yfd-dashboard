import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/dashboard/Skeleton";

// Mirrors the 3-column stage board (Pending / Ready for Approval / Waiting
// on Customer).
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} columns={3} lines={4} />
    </div>
  );
}
