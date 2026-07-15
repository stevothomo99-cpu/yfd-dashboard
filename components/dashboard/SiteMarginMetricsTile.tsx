"use client";

interface SiteMarginMetricsTileProps {
  businessName: string;
  totalOrganizations: number;
  activeTrials: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  canceledOrganizations: number;
  pastDueOrganizations: number;
  isLoading?: boolean;
  note?: string;
}

export function SiteMarginMetricsTile({
  businessName,
  totalOrganizations,
  activeTrials,
  activeSubscriptions,
  trialConversionRate,
  canceledOrganizations,
  pastDueOrganizations,
  isLoading = false,
  note,
}: SiteMarginMetricsTileProps) {
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

  const activeRate =
    totalOrganizations > 0
      ? (((activeTrials + activeSubscriptions) / totalOrganizations) * 100).toFixed(1)
      : "0";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {businessName} — Trial & Subscription
      </h3>

      {note && (
        <div className="bg-blue-50 border border-blue-200 rounded px-3 py-2 mb-4 text-xs text-blue-700">
          ℹ️ {note}
        </div>
      )}

      <div className="grid grid-cols-2 gap-6">
        {/* Total Organizations */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Total Organizations</p>
          <p className="text-3xl font-bold text-blue-600">{totalOrganizations}</p>
        </div>

        {/* Active Trials */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Active Trials</p>
          <p className="text-3xl font-bold text-amber-600">{activeTrials}</p>
        </div>

        {/* Active Subscriptions */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Active Subscriptions</p>
          <p className="text-3xl font-bold text-green-600">{activeSubscriptions}</p>
        </div>

        {/* Trial Conversion Rate */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Conversion Rate</p>
          <p className="text-3xl font-bold text-purple-600">{trialConversionRate}%</p>
          <p className="text-xs text-gray-500 mt-1">trial → paid</p>
        </div>

        {/* Canceled Organizations */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Canceled</p>
          <p className="text-3xl font-bold text-red-600">{canceledOrganizations}</p>
        </div>

        {/* Past Due */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Past Due</p>
          <p className="text-3xl font-bold text-orange-600">{pastDueOrganizations}</p>
        </div>

        {/* Active Rate */}
        <div className="col-span-2">
          <p className="text-sm text-gray-600 mb-1">Active Rate</p>
          <p className="text-3xl font-bold text-blue-600">{activeRate}%</p>
          <p className="text-xs text-gray-500 mt-1">
            {activeTrials + activeSubscriptions} of {totalOrganizations} organizations
          </p>
        </div>
      </div>
    </div>
  );
}
