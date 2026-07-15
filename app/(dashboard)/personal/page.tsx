"use client";

import { useEffect, useState } from "react";
import { BusinessKpiTile } from "@/components/dashboard/BusinessKpiTile";
import { SubscriptionMetricsTile } from "@/components/dashboard/SubscriptionMetricsTile";
import PageHeader from "@/components/dashboard/PageHeader";

interface DealKPIs {
  focablyED: {
    newLeads: number;
    activeDealCount: number;
    activeDealValue: number;
    wonDealsThisMonth: number;
    avgDaysToClose: number;
  } | null;
  siteMargin: {
    newLeads: number;
    activeDealCount: number;
    activeDealValue: number;
    wonDealsThisMonth: number;
    avgDaysToClose: number;
  } | null;
  error?: string;
  lastUpdated: string;
}

interface FocablyMetrics {
  totalUsers: number;
  paidUsers: number;
  freemiumUsers: number;
  nonActiveUsers: number;
  paidChurnThisMonth: number;
  unpaidChurnThisMonth: number;
  totalChurnThisMonth: number;
  churnRate: number;
  winBackCandidates: number;
  lastUpdated: string;
  error?: string;
}

export default function PersonalDashboard() {
  const [kpis, setKpis] = useState<DealKPIs | null>(null);
  const [focablyMetrics, setFocablyMetrics] = useState<FocablyMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpisRes, focablyRes] = await Promise.all([
          fetch("/api/hubspot/deals"),
          fetch("/api/focably/metrics"),
        ]);

        const kpisData: DealKPIs = await kpisRes.json();
        const focablyData: FocablyMetrics = await focablyRes.json();

        setKpis(kpisData);
        setFocablyMetrics(focablyData);
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setKpis({
          focablyED: null,
          siteMargin: null,
          error: "Failed to load HubSpot data",
          lastUpdated: new Date().toISOString(),
        });
        setFocablyMetrics({
          totalUsers: 0,
          paidUsers: 0,
          freemiumUsers: 0,
          nonActiveUsers: 0,
          paidChurnThisMonth: 0,
          unpaidChurnThisMonth: 0,
          totalChurnThisMonth: 0,
          churnRate: 0,
          winBackCandidates: 0,
          lastUpdated: new Date().toISOString(),
          error: "Failed to load Focably metrics",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const [kpisRes, focablyRes] = await Promise.all([
        fetch("/api/hubspot/deals", { method: "POST" }),
        fetch("/api/focably/metrics"),
      ]);

      const kpisData: DealKPIs = await kpisRes.json();
      const focablyData: FocablyMetrics = await focablyRes.json();

      setKpis(kpisData);
      setFocablyMetrics(focablyData);
    } catch (err) {
      console.error("Failed to refresh data:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="Business KPIs"
        subtitle="HubSpot pipeline metrics across all products"
      />

      {(kpis?.error || focablyMetrics?.error) && (
        <div
          style={{
            fontSize: "12px",
            color: "#7f1d1d",
            background: "#fee2e2",
            border: "0.5px solid #fecaca",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "14px",
          }}
        >
          ⚠️ {kpis?.error || focablyMetrics?.error}
        </div>
      )}

      <div>
        {/* HubSpot Deal KPIs */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sales Pipeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* FocablyED */}
          {kpis?.focablyED ? (
            <BusinessKpiTile
              businessName="FocablyED"
              newLeads={kpis.focablyED.newLeads}
              activeDealCount={kpis.focablyED.activeDealCount}
              activeDealValue={kpis.focablyED.activeDealValue}
              wonDealsThisMonth={kpis.focablyED.wonDealsThisMonth}
              avgDaysToClose={kpis.focablyED.avgDaysToClose}
              isLoading={loading}
            />
          ) : (
            <BusinessKpiTile
              businessName="FocablyED"
              newLeads={0}
              activeDealCount={0}
              activeDealValue={0}
              wonDealsThisMonth={0}
              avgDaysToClose={0}
              isLoading={true}
            />
          )}

          {/* SiteMargin */}
          {kpis?.siteMargin ? (
            <BusinessKpiTile
              businessName="SiteMargin"
              newLeads={kpis.siteMargin.newLeads}
              activeDealCount={kpis.siteMargin.activeDealCount}
              activeDealValue={kpis.siteMargin.activeDealValue}
              wonDealsThisMonth={kpis.siteMargin.wonDealsThisMonth}
              avgDaysToClose={kpis.siteMargin.avgDaysToClose}
              isLoading={loading}
            />
          ) : (
            <BusinessKpiTile
              businessName="SiteMargin"
              newLeads={0}
              activeDealCount={0}
              activeDealValue={0}
              wonDealsThisMonth={0}
              avgDaysToClose={0}
              isLoading={true}
            />
          )}
        </div>
      </div>

      <div>
        {/* Subscription Metrics */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">User & Churn Metrics</h2>
        <div className="grid grid-cols-1 gap-6 mb-8">
          {/* FocablyED Subscription Metrics */}
          {focablyMetrics ? (
            <SubscriptionMetricsTile
              businessName="FocablyED"
              totalUsers={focablyMetrics.totalUsers}
              paidUsers={focablyMetrics.paidUsers}
              freemiumUsers={focablyMetrics.freemiumUsers}
              nonActiveUsers={focablyMetrics.nonActiveUsers}
              totalChurnThisMonth={focablyMetrics.totalChurnThisMonth}
              churnRate={focablyMetrics.churnRate}
              winBackCandidates={focablyMetrics.winBackCandidates}
              isLoading={loading}
            />
          ) : (
            <SubscriptionMetricsTile
              businessName="FocablyED"
              totalUsers={0}
              paidUsers={0}
              freemiumUsers={0}
              nonActiveUsers={0}
              totalChurnThisMonth={0}
              churnRate={0}
              winBackCandidates={0}
              isLoading={true}
            />
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={handleRefresh}
          disabled={loading}
          className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Refresh"}
        </button>
      </div>

      {(kpis?.lastUpdated || focablyMetrics?.lastUpdated) && (
        <p className="text-xs text-gray-500 mt-4">
          Last updated: {new Date(kpis?.lastUpdated || focablyMetrics?.lastUpdated || "").toLocaleString()}
        </p>
      )}
    </div>
  );
}
