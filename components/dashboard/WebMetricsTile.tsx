"use client";

import { useEffect, useState } from "react";
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

type ProductKey = "siteMargin" | "focablyED" | "yfd";

interface WebMetricsTileProps {
  productKey: ProductKey;
  productName: string;
}

type TimePeriod = "24h" | "week" | "month";

const periodDays: Record<TimePeriod, number> = {
  "24h": 1,
  week: 7,
  month: 30,
};

const periodLabels: Record<TimePeriod, string> = {
  "24h": "24h",
  week: "7d",
  month: "30d",
};

export function WebMetricsTile({ productKey, productName }: WebMetricsTileProps) {
  const [period, setPeriod] = useState<TimePeriod>("week");
  const [searchConsole, setSearchConsole] = useState<SearchConsoleMetrics | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const days = periodDays[period];
        const [searchConsoleRes, analyticsRes] = await Promise.all([
          fetch(`/api/google/search-console?days=${days}`),
          fetch(`/api/google/analytics?days=${days}`),
        ]);

        const searchConsoleJson = await searchConsoleRes.json();
        const analyticsJson = await analyticsRes.json();

        if (cancelled) return;

        const sc = searchConsoleJson[productKey] ?? null;
        const an = analyticsJson[productKey] ?? null;

        setSearchConsole(sc);
        setAnalytics(an);
        setErrorMsg(sc === null || an === null ? "Not yet configured" : undefined);
      } catch (err) {
        if (cancelled) return;
        console.error(`Failed to fetch web metrics for ${productKey}:`, err);
        setErrorMsg("Not yet configured");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [productKey, period]);

  const handlePeriodChange = (newPeriod: TimePeriod) => {
    setPeriod(newPeriod);
  };

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold">{productName}</h3>
      <div className="flex gap-2">
        {(["24h", "week", "month"] as const).map((p) => (
          <button
            key={p}
            onClick={() => handlePeriodChange(p)}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              period === p
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white text-gray-700 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-50"
            } disabled:opacity-50 cursor-pointer`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {header}
        <div className="space-y-3">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-6 w-28" />
        </div>
      </div>
    );
  }

  if (errorMsg || !searchConsole || !analytics) {
    return (
      <div className="rounded-lg border bg-card p-6">
        {header}
        <p className="text-sm text-muted-foreground">
          {errorMsg || "No data available"}
        </p>
      </div>
    );
  }

  const sc = searchConsole;
  const an = analytics;
  const sessionsPerUser = an.users > 0 ? (an.sessions / an.users).toFixed(2) : "0";
  const pageviewsPerSession =
    an.sessions > 0 ? (an.pageviews / an.sessions).toFixed(2) : "0";

  return (
    <div className="rounded-lg border bg-card p-6">
      {header}

      <div className="grid grid-cols-2 gap-8">
        {/* Search Console */}
        <div>
          <h4 className="mb-4 text-sm font-semibold text-muted-foreground">
            Search Console ({periodLabels[period]})
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
            Analytics ({periodLabels[period]})
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
