"use client";

import { useEffect, useState } from "react";
import { BusinessKpiTile } from "@/components/dashboard/BusinessKpiTile";
import { SubscriptionMetricsTile } from "@/components/dashboard/SubscriptionMetricsTile";
import { SiteMarginMetricsTile } from "@/components/dashboard/SiteMarginMetricsTile";
import { WebMetricsTile } from "@/components/dashboard/WebMetricsTile";
import PageHeader from "@/components/dashboard/PageHeader";

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

interface WebMetricsData {
  searchConsole: SearchConsoleMetrics | null;
  analytics: AnalyticsMetrics | null;
}

interface XeroSalesMetrics {
  monthTotal: number;
  ytdTotal: number;
  error?: string;
}

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
  yfd: {
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

interface SiteMarginMetrics {
  totalOrganizations: number;
  activeTrials: number;
  activeSubscriptions: number;
  trialConversionRate: number;
  canceledOrganizations: number;
  pastDueOrganizations: number;
  paidChurnThisMonth: number;
  untrialChurnThisMonth: number;
  lastUpdated: string;
  note?: string;
  error?: string;
}

export default function PersonalDashboard() {
  const [kpis, setKpis] = useState<DealKPIs | null>(null);
  const [focablyMetrics, setFocablyMetrics] = useState<FocablyMetrics | null>(null);
  const [siteMarginMetrics, setSiteMarginMetrics] = useState<SiteMarginMetrics | null>(null);
  const [xeroSales, setXeroSales] = useState<XeroSalesMetrics | null>(null);
  const [siteMarginWeb, setSiteMarginWeb] = useState<WebMetricsData | null>(null);
  const [focablyWeb, setFocablyWeb] = useState<WebMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [webMetricsPeriod, setWebMetricsPeriod] = useState<"24h" | "7d" | "30d">("30d");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpisRes, focablyRes, siteMarginRes, xeroRes, searchConsoleRes, analyticsRes] = await Promise.all([
          fetch("/api/hubspot/deals"),
          fetch("/api/focably/metrics"),
          fetch("/api/sitemargin/metrics"),
          fetch("/api/xpm/sales"),
          fetch("/api/google/search-console"),
          fetch("/api/google/analytics"),
        ]);

        const kpisData: DealKPIs = await kpisRes.json();
        const focablyData: FocablyMetrics = await focablyRes.json();
        const siteMarginData: SiteMarginMetrics = await siteMarginRes.json();
        const xeroData: XeroSalesMetrics = await xeroRes.json();
        const searchConsoleData = await searchConsoleRes.json();
        const analyticsData = await analyticsRes.json();

        setKpis(kpisData);
        setFocablyMetrics(focablyData);
        setSiteMarginMetrics(siteMarginData);
        setXeroSales(xeroData);
        setSiteMarginWeb({
          searchConsole: searchConsoleData.siteMargin,
          analytics: analyticsData.siteMargin,
        });
        setFocablyWeb({
          searchConsole: searchConsoleData.focablyED,
          analytics: analyticsData.focablyED,
        });
      } catch (err) {
        console.error("Failed to fetch dashboard data:", err);
        setKpis({
          focablyED: null,
          siteMargin: null,
          yfd: null,
          error: "Failed to load data",
          lastUpdated: new Date().toISOString(),
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
      const [kpisRes, focablyRes, siteMarginRes, xeroRes, searchConsoleRes, analyticsRes] = await Promise.all([
        fetch("/api/hubspot/deals", { method: "POST" }),
        fetch("/api/focably/metrics"),
        fetch("/api/sitemargin/metrics"),
        fetch("/api/xpm/sales", { method: "POST" }),
        fetch("/api/google/search-console"),
        fetch("/api/google/analytics"),
      ]);

      const kpisData: DealKPIs = await kpisRes.json();
      const focablyData: FocablyMetrics = await focablyRes.json();
      const siteMarginData: SiteMarginMetrics = await siteMarginRes.json();
      const xeroData: XeroSalesMetrics = await xeroRes.json();
      const searchConsoleData = await searchConsoleRes.json();
      const analyticsData = await analyticsRes.json();

      setKpis(kpisData);
      setFocablyMetrics(focablyData);
      setSiteMarginMetrics(siteMarginData);
      setXeroSales(xeroData);
      setSiteMarginWeb({
        searchConsole: searchConsoleData.siteMargin,
        analytics: analyticsData.siteMargin,
      });
      setFocablyWeb({
        searchConsole: searchConsoleData.focablyED,
        analytics: analyticsData.focablyED,
      });
    } catch (err) {
      console.error("Failed to refresh data:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleWebMetricsPeriodChange = async (days: number) => {
    const periodLabel = days === 1 ? "24h" : days === 7 ? "7d" : "30d";
    setWebMetricsPeriod(periodLabel as "24h" | "7d" | "30d");
    try {
      const [searchConsoleRes, analyticsRes] = await Promise.all([
        fetch(`/api/google/search-console?days=${days}`),
        fetch(`/api/google/analytics?days=${days}`),
      ]);

      const searchConsoleData = await searchConsoleRes.json();
      const analyticsData = await analyticsRes.json();

      setSiteMarginWeb({
        searchConsole: searchConsoleData.siteMargin,
        analytics: analyticsData.siteMargin,
      });
      setFocablyWeb({
        searchConsole: searchConsoleData.focablyED,
        analytics: analyticsData.focablyED,
      });
    } catch (err) {
      console.error("Failed to fetch web metrics for period:", err);
    }
  };

  return (
    <div>
      <PageHeader
        title="Business KPIs"
        subtitle="HubSpot pipeline metrics across all products"
      />

      {(kpis?.error) && (
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
          ⚠️ {kpis?.error}
        </div>
      )}

      <div>
        {/* HubSpot Deal KPIs */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Sales Pipeline</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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

          {/* YFD */}
          <div className="rounded-lg border bg-card p-6">
            <h3 className="text-lg font-semibold mb-4">YFD — Sales</h3>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Month Total</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : xeroSales?.monthTotal ? `$${(xeroSales.monthTotal / 1000).toFixed(1)}k` : "$0"}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">YTD Total</p>
                <p className="text-2xl font-bold">
                  {loading ? "..." : xeroSales?.ytdTotal ? `$${(xeroSales.ytdTotal / 1000).toFixed(1)}k` : "$0"}
                </p>
              </div>
              {xeroSales?.error && (
                <p className="text-xs text-red-600">{xeroSales.error}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Web Metrics */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">Web Metrics ({webMetricsPeriod})</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <WebMetricsTile
            productName="SiteMargin"
            data={siteMarginWeb}
            loading={loading}
            error={siteMarginWeb?.searchConsole === null ? "Search Console not connected" : undefined}
            onPeriodChange={handleWebMetricsPeriodChange}
          />
          <WebMetricsTile
            productName="FocablyED"
            data={focablyWeb}
            loading={loading}
            error={focablyWeb?.searchConsole === null ? "Not yet configured" : undefined}
            onPeriodChange={handleWebMetricsPeriodChange}
          />
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

          {/* SiteMargin Trial & Subscription Metrics */}
          {siteMarginMetrics ? (
            <SiteMarginMetricsTile
              businessName="SiteMargin"
              totalOrganizations={siteMarginMetrics.totalOrganizations}
              activeTrials={siteMarginMetrics.activeTrials}
              activeSubscriptions={siteMarginMetrics.activeSubscriptions}
              trialConversionRate={siteMarginMetrics.trialConversionRate}
              canceledOrganizations={siteMarginMetrics.canceledOrganizations}
              pastDueOrganizations={siteMarginMetrics.pastDueOrganizations}
              isLoading={loading}
              note={siteMarginMetrics.note}
            />
          ) : (
            <SiteMarginMetricsTile
              businessName="SiteMargin"
              totalOrganizations={0}
              activeTrials={0}
              activeSubscriptions={0}
              trialConversionRate={0}
              canceledOrganizations={0}
              pastDueOrganizations={0}
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

      {(kpis?.lastUpdated || focablyMetrics?.lastUpdated || siteMarginMetrics?.lastUpdated) && (
        <p className="text-xs text-gray-500 mt-4">
          Last updated: {new Date(kpis?.lastUpdated || focablyMetrics?.lastUpdated || siteMarginMetrics?.lastUpdated || "").toLocaleString()}
        </p>
      )}
    </div>
  );
}
