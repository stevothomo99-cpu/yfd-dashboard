"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface SearchConsoleMetrics {
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  topQueries: Array<{ query: string; clicks: number; impressions: number }>;
}

interface AnalyticsMetrics {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
}

interface WebMetricsData {
  searchConsole: SearchConsoleMetrics | null;
  analytics: AnalyticsMetrics | null;
}

interface WebMetricsTileProps {
  productName: string;
  data: WebMetricsData | null;
  loading: boolean;
  error?: string;
}

export function WebMetricsTile({
  productName,
  data,
  loading,
  error,
}: WebMetricsTileProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">{productName}</h3>
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    );
  }

  if (error || !data?.searchConsole || !data?.analytics) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">{productName}</h3>
        <p className="text-sm text-muted-foreground">
          {error || "No data available"}
        </p>
      </div>
    );
  }

  const sc = data.searchConsole;
  const an = data.analytics;
  const sessionsPerUser = an.users > 0 ? (an.sessions / an.users).toFixed(2) : "0";
  const pageviewsPerSession =
    an.sessions > 0 ? (an.pageviews / an.sessions).toFixed(2) : "0";

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-6 text-lg font-semibold">{productName}</h3>

      <div className="grid grid-cols-2 gap-8">
        {/* Search Console */}
        <div>
          <h4 className="mb-4 text-sm font-semibold text-muted-foreground">
            Search Console (30d)
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Clicks</p>
                <p className="text-xl font-bold">{sc.clicks.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Impressions</p>
                <p className="text-xl font-bold">
                  {sc.impressions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">CTR</p>
                <p className="text-xl font-bold">{(sc.ctr * 100).toFixed(2)}%</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Avg Pos</p>
                <p className="text-xl font-bold">{sc.avgPosition.toFixed(1)}</p>
              </div>
            </div>

            {/* Top Queries */}
            {sc.topQueries.length > 0 && (
              <div className="pt-3 border-t">
                <p className="mb-2 text-xs font-semibold">Top Queries</p>
                <div className="space-y-1">
                  {sc.topQueries.slice(0, 3).map((query, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between text-xs"
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

        {/* Analytics */}
        <div>
          <h4 className="mb-4 text-sm font-semibold text-muted-foreground">
            Analytics (30d)
          </h4>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Sessions</p>
                <p className="text-xl font-bold">
                  {an.sessions.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Users</p>
                <p className="text-xl font-bold">{an.users.toLocaleString()}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pageviews</p>
                <p className="text-xl font-bold">
                  {an.pageviews.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bounce Rate</p>
                <p className="text-xl font-bold">
                  {(an.bounceRate * 100).toFixed(1)}%
                </p>
              </div>
            </div>

            {/* Derived Metrics */}
            <div className="border-t pt-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="text-muted-foreground">Sessions/User</p>
                  <p className="font-semibold">{sessionsPerUser}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Pages/Session</p>
                  <p className="font-semibold">{pageviewsPerSession}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
