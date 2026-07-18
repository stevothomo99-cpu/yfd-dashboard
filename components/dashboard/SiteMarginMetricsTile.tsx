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

interface SiteMarginMetrics {
  totalOrganizations: number;
  activeTrials: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  canceledOrganizations: number;
  pastDueOrganizations: number;
  paidChurnInPeriod: number;
  untrialChurnInPeriod: number;
  currentMonthMRR?: number;
  currentMonthARR?: number;
  lastUpdated: string;
  note?: string;
  error?: string;
}

interface SiteMarginMetricsTileProps {
  businessName: string;
}

export function SiteMarginMetricsTile({ businessName }: SiteMarginMetricsTileProps) {
  const [range, setRange] = useState<ChurnRange>("month");
  const [metrics, setMetrics] = useState<SiteMarginMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/sitemargin/metrics?range=${range}`);
        const data: SiteMarginMetrics = await res.json();
        if (!cancelled) setMetrics(data);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to fetch SiteMargin subscription metrics:", err);
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

  const header = (
    <div className="flex items-center justify-between mb-6">
      <h3 className="text-lg font-semibold text-gray-900">
        {businessName} — Trial & Subscription
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
    totalOrganizations,
    activeTrials,
    activeSubscriptions,
    trialConversionRate,
    canceledOrganizations,
    pastDueOrganizations,
    currentMonthMRR = 0,
    currentMonthARR = 0,
    note,
  } = metrics;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("en-AU", {
      style: "currency",
      currency: "AUD",
      minimumFractionDigits: 0,
    }).format(val);
  };

  const activeRate =
    totalOrganizations > 0
      ? (((activeTrials + activeSubscriptions) / totalOrganizations) * 100).toFixed(1)
      : "0";

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      {header}

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
