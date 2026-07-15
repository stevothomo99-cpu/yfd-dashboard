"use client";

interface AnalyticsMetricsTileProps {
  businessName: string;
  sessions: number;
  users: number;
  pageviews: number;
  bounceRate: number;
  isLoading?: boolean;
}

export function AnalyticsMetricsTile({
  businessName,
  sessions,
  users,
  pageviews,
  bounceRate,
  isLoading = false,
}: AnalyticsMetricsTileProps) {
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

  const sessionPerUser = users > 0 ? (sessions / users).toFixed(2) : "0";
  const pageviewsPerSession = sessions > 0 ? (pageviews / sessions).toFixed(2) : "0";
  const bounceRatePercent = (bounceRate || 0).toFixed(1);

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {businessName} — Google Analytics
      </h3>

      <div className="grid grid-cols-2 gap-6">
        {/* Sessions */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Sessions (30d)</p>
          <p className="text-3xl font-bold text-blue-600">{sessions}</p>
        </div>

        {/* Users */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Users (30d)</p>
          <p className="text-3xl font-bold text-green-600">{users}</p>
          <p className="text-xs text-gray-500 mt-1">{sessionPerUser} sessions/user</p>
        </div>

        {/* Pageviews */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Pageviews (30d)</p>
          <p className="text-3xl font-bold text-purple-600">{pageviews}</p>
          <p className="text-xs text-gray-500 mt-1">{pageviewsPerSession} per session</p>
        </div>

        {/* Bounce Rate */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Bounce Rate</p>
          <p className="text-3xl font-bold text-amber-600">{bounceRatePercent}%</p>
        </div>
      </div>
    </div>
  );
}
