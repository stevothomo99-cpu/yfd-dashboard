"use client";

interface BusinessKpiTileProps {
  businessName: string;
  newLeads: number;
  activeDealCount: number;
  activeDealValue: number;
  wonDealsThisMonth: number;
  avgDaysToClose: number;
  isLoading?: boolean;
}

export function BusinessKpiTile({
  businessName,
  newLeads,
  activeDealCount,
  activeDealValue,
  wonDealsThisMonth,
  avgDaysToClose,
  isLoading = false,
}: BusinessKpiTileProps) {
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

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{businessName}</h3>

      <div className="grid grid-cols-2 gap-6">
        {/* New Leads */}
        <div>
          <p className="text-sm text-gray-600 mb-1">New Leads (30d)</p>
          <p className="text-3xl font-bold text-blue-600">{newLeads}</p>
        </div>

        {/* Active Deals */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Active Deals</p>
          <p className="text-3xl font-bold text-amber-600">{activeDealCount}</p>
          <p className="text-xs text-gray-500 mt-1">
            {formatCurrency(activeDealValue)}
          </p>
        </div>

        {/* Won This Month */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Won This Month</p>
          <p className="text-3xl font-bold text-green-600">
            {wonDealsThisMonth}
          </p>
        </div>

        {/* Avg Days to Close */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Avg Days to Close</p>
          <p className="text-3xl font-bold text-purple-600">{avgDaysToClose}</p>
          <p className="text-xs text-gray-500 mt-1">days</p>
        </div>
      </div>
    </div>
  );
}
