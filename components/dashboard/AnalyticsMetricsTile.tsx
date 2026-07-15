"use client";

import { Skeleton } from "@/components/ui/skeleton";

interface AnalyticsMetricsData {
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
}

interface AnalyticsMetricsTileProps {
  data: AnalyticsMetricsData | null;
  loading: boolean;
  error?: string;
}

export function AnalyticsMetricsTile({
  data,
  loading,
  error,
}: AnalyticsMetricsTileProps) {
  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        <h3 className="mb-4 text-lg font-semibold">Analytics (30d)</h3>
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
        <h3 className="mb-4 text-lg font-semibold">Analytics (30d)</h3>
        <p className="text-sm text-muted-foreground">
          {error || "No data available"}
        </p>
      </div>
    );
  }

  const sessionsPerUser =
    data.users > 0 ? (data.sessions / data.users).toFixed(2) : "0";
  const pageviewsPerSession =
    data.sessions > 0 ? (data.pageviews / data.sessions).toFixed(2) : "0";

  return (
    <div className="rounded-lg border bg-card p-6">
      <h3 className="mb-4 text-lg font-semibold">Analytics (30d)</h3>

      <div className="space-y-4">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Sessions</p>
            <p className="text-2xl font-bold">
              {data.sessions.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Users</p>
            <p className="text-2xl font-bold">{data.users.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Pageviews</p>
            <p className="text-2xl font-bold">
              {data.pageviews.toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Bounce Rate</p>
            <p className="text-2xl font-bold">
              {(data.bounceRate * 100).toFixed(1)}%
            </p>
          </div>
        </div>

        {/* Derived Metrics */}
        <div className="border-t pt-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Sessions/User</p>
              <p className="font-semibold">{sessionsPerUser}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Pageviews/Session</p>
              <p className="font-semibold">{pageviewsPerSession}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
