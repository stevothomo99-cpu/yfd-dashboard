"use client";

interface SearchConsoleMetricsTileProps {
  businessName: string;
  clicks: number;
  impressions: number;
  ctr: number;
  avgPosition: number;
  topQueries?: Array<{ query: string; clicks: number; impressions: number }>;
  isLoading?: boolean;
}

export function SearchConsoleMetricsTile({
  businessName,
  clicks,
  impressions,
  ctr,
  avgPosition,
  topQueries = [],
  isLoading = false,
}: SearchConsoleMetricsTileProps) {
  if (isLoading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 animate-pulse">
        <div className="h-6 bg-gray-200 rounded w-24 mb-4" />
        <div className="space-y-3">
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
          <div className="h-4 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  const ctrPercent = (ctr * 100).toFixed(2);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {businessName} — Search Console
      </h3>

      <div className="grid grid-cols-2 gap-6 mb-6">
        {/* Clicks */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Clicks (30d)</p>
          <p className="text-3xl font-bold text-blue-600">{clicks}</p>
        </div>

        {/* Impressions */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Impressions (30d)</p>
          <p className="text-3xl font-bold text-purple-600">{impressions}</p>
        </div>

        {/* CTR */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Click-Through Rate</p>
          <p className="text-3xl font-bold text-green-600">{ctrPercent}%</p>
        </div>

        {/* Avg Position */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Avg Position</p>
          <p className="text-3xl font-bold text-amber-600">{avgPosition}</p>
        </div>
      </div>

      {topQueries.length > 0 && (
        <div>
          <p className="text-sm font-semibold text-gray-900 mb-3">
            Top Search Queries
          </p>
          <div className="space-y-2">
            {topQueries.slice(0, 5).map((q, idx) => (
              <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 last:border-0">
                <p className="text-sm text-gray-700 truncate flex-1 pr-4">{q.query}</p>
                <div className="flex gap-4 text-right">
                  <p className="text-sm text-gray-600">{q.clicks} clicks</p>
                  <p className="text-sm text-gray-500">{q.impressions} impr</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
