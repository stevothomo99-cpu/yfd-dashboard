"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SearchConsoleMetricsData {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number }>;
}

interface SearchConsoleMetricsTileProps {
  data: SearchConsoleMetricsData | null;
  loading: boolean;
  error?: string;
}

export function SearchConsoleMetricsTile({
  data,
  loading,
  error,
}: SearchConsoleMetricsTileProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Search Console</h3>
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Search Console</h3>
        <p className="text-sm text-muted-foreground">
          {error || "No data available"}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Search Console</h3>

      <div className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Clicks</p>
            <p className="text-2xl font-bold">{data.clicks.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Impressions</p>
            <p className="text-2xl font-bold">
              {data.impressions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">CTR</p>
            <p className="text-2xl font-bold">{(data.ctr * 100).toFixed(2)}%</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Avg Position</p>
            <p className="text-2xl font-bold">{data.avgPosition.toFixed(1)}</p>
          </div>
        </div>

        {/* Top Queries */}
        {data.topQueries.length > 0 && (
          <div className="pt-4">
            <p className="mb-3 text-sm font-semibold">Top Queries</p>
            <div className="space-y-2">
              {data.topQueries.slice(0, 5).map((query, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="truncate text-muted-foreground">
                    {query.query}
                  </span>
                  <span className="ml-2 font-medium">{query.clicks}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
