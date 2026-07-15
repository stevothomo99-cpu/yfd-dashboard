"use client";

interface SubscriptionMetricsTileProps {
  businessName: string;
  totalUsers: number;
  paidUsers: number;
  freemiumUsers: number;
  nonActiveUsers: number;
  totalChurnThisMonth: number;
  churnRate: number;
  winBackCandidates: number;
  currentMonthMRR?: number;
  currentMonthARR?: number;
  isLoading?: boolean;
}

export function SubscriptionMetricsTile({
  businessName,
  totalUsers,
  paidUsers,
  freemiumUsers,
  nonActiveUsers,
  totalChurnThisMonth,
  churnRate,
  winBackCandidates,
  currentMonthMRR = 0,
  currentMonthARR = 0,
  isLoading = false,
}: SubscriptionMetricsTileProps) {
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

  const conversionRate =
    totalUsers > 0 ? ((paidUsers / totalUsers) * 100).toFixed(1) : "0";
  const retentionRate = totalUsers > 0 ? (((totalUsers - nonActiveUsers) / totalUsers) * 100).toFixed(1) : "0";

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(val);
  };

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">
        {businessName} — Users & Churn
      </h3>

      <div className="grid grid-cols-2 gap-6">
        {/* Total Users */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Total Users</p>
          <p className="text-3xl font-bold text-blue-600">{totalUsers}</p>
        </div>

        {/* Paid Users */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Paid Users</p>
          <p className="text-3xl font-bold text-green-600">{paidUsers}</p>
          <p className="text-xs text-gray-500 mt-1">{conversionRate}% conversion</p>
        </div>

        {/* Freemium */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Freemium Users</p>
          <p className="text-3xl font-bold text-purple-600">{freemiumUsers}</p>
        </div>

        {/* Non-Active */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Non-Active (30d)</p>
          <p className="text-3xl font-bold text-amber-600">{nonActiveUsers}</p>
          <p className="text-xs text-gray-500 mt-1">{retentionRate}% active</p>
        </div>

        {/* Churn This Month */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Churn This Month</p>
          <p className="text-3xl font-bold text-red-600">{totalChurnThisMonth}</p>
        </div>

        {/* Churn Rate */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Monthly Churn Rate</p>
          <p className="text-3xl font-bold text-red-700">{churnRate}%</p>
        </div>

        {/* Current Month MRR */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Current Month MRR</p>
          <p className="text-3xl font-bold text-teal-600">{formatCurrency(currentMonthMRR)}</p>
        </div>

        {/* Current Month ARR */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Current Month ARR</p>
          <p className="text-3xl font-bold text-cyan-600">{formatCurrency(currentMonthARR)}</p>
        </div>

        {/* Win-Back Candidates */}
        <div className="col-span-2">
          <p className="text-sm text-gray-600 mb-1">Win-Back Candidates</p>
          <p className="text-3xl font-bold text-indigo-600">{winBackCandidates}</p>
          <p className="text-xs text-gray-500 mt-1">
            Churned but still active on free tier
          </p>
        </div>
      </div>
    </div>
  );
}
