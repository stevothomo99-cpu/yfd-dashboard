import { PageHeaderSkeleton, CardGridSkeleton } from "@/components/dashboard/Skeleton";

// Group-level fallback: any route under (dashboard) without its own
// loading.tsx gets this during navigation.
export default function Loading() {
  return (
    <div>
      <PageHeaderSkeleton />
      <CardGridSkeleton count={3} columns={3} />
    </div>
  );
}
