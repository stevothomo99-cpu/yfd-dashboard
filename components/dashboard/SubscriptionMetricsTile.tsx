"use client";

import { useEffect, useState } from "react";
import type { ChurnRange } from "@/lib/utils";

const CHURN_RANGE_LABELS: Record<ChurnRange, string> = {
  all: "All Time",
  "12m": "Last 12 Months",
  fy: "Financial Year",
  month: "This Month",
  week: "This Week",
  "24h": "Last 24 Hours",
};

interface FocablyMetrics {
  totalUsers: number;
  paidUsers: number;
  freemiumUsers: number;
  nonActiveUsers: number;
  paidChurnInPeriod: number;
  unpaidChurnInPeriod: number;
  totalChurnInPeriod: number;
  churnRate: number;
  winBackCandidates: number;
  currentMonthMRR?: number;
  currentMonthARR?: number;
  lastUpdated: string;
  error?: string;
}

interface SubscriptionMetricsTileProps {
  businessName: string;
}

export function SubscriptionMetricsTile({ businessName }: SubscriptionMetricsTileProps) {
  const [range, setRange] = useState<ChurnRange>("month");
  const [metrics, setMetrics] = useState<FocablyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/focably/metrics?range=${range}`);
        const data: FocablyMetrics = await res.json();
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch FocablyED subscription metrics:", err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [range]);

  const periodLabel = CHURN_RANGE_LABELS[range];

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900">
        {businessName} — Users & Churn
      </h3>
      <div className="flex gap-2">
        {(["all", "12m", "fy", "month", "week", "24h"] as const).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            disabled={loading}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
              range === r
                ? "bg-blue-600 text-white shadow-lg shadow-blue-600/30"
                : "bg-white text-gray-700 border border-gray-200 shadow-md hover:shadow-lg hover:bg-gray-50"
            } disabled:opacity-50 cursor-pointer`}
          >
            {CHURN_RANGE_LABELS[r]}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) {
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

  if (!metrics) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        {header}
        <p className="text-sm text-gray-600">No data available</p>
      </div>
    );
  }

  const {
    totalUsers,
    paidUsers,
    freemiumUsers,
    nonActiveUsers,
    totalChurnInPeriod,
    churnRate,
    winBackCandidates,
    currentMonthMRR = 0,
    currentMonthARR = 0,
    error,
  } = metrics;

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
      {header}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded px-3 py-2 mb-4 text-xs text-red-700">
          {error}
        </div>
      )}

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

        {/* Churn in period */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Churn ({periodLabel})</p>
          <p className="text-3xl font-bold text-red-600">{totalChurnInPeriod}</p>
        </div>

        {/* Churn Rate */}
        <div>
          <p className="text-sm text-gray-600 mb-1">Churn Rate ({periodLabel})</p>
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
