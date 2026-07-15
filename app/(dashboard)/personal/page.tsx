"use client";

import { useEffect, useState } from "react";
import { BusinessKpiTile } from "@/components/dashboard/BusinessKpiTile";
import { SubscriptionMetricsTile } from "@/components/dashboard/SubscriptionMetricsTile";
import { SiteMarginMetricsTile } from "@/components/dashboard/SiteMarginMetricsTile";
import { SearchConsoleMetricsTile } from "@/components/dashboard/SearchConsoleMetricsTile";
import { AnalyticsMetricsTile } from "@/components/dashboard/AnalyticsMetricsTile";
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
  currentMonthMRR: number;
  currentMonthARR: number;
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
  currentMonthMRR: number;
  currentMonthARR: number;
  lastUpdated: string;
  note?: string;
  error?: string;
}

interface SearchConsoleMetrics {
  siteMargin: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  } | null;
  focablyED: {
    clicks: number;
    impressions: number;
    ctr: number;
    avgPosition: number;
    topQueries: Array<{ query: string; clicks: number; impressions: number }>;
  } | null;
  error?: string;
  lastUpdated: string;
}

interface AnalyticsMetrics {
  siteMargin: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
  } | null;
  focablyED: {
    sessions: number;
    users: number;
    pageviews: number;
    bounceRate: number;
  } | null;
  error?: string;
  lastUpdated: string;
}

export default function PersonalDashboard() {
  const [kpis, setKpis] = useState<DealKPIs | null>(null);
  const [focablyMetrics, setFocablyMetrics] = useState<FocablyMetrics | null>(null);
  const [siteMarginMetrics, setSiteMarginMetrics] = useState<SiteMarginMetrics | null>(null);
  const [searchConsoleMetrics, setSearchConsoleMetrics] = useState<SearchConsoleMetrics | null>(null);
  const [analyticsMetrics, setAnalyticsMetrics] = useState<AnalyticsMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpisRes, focablyRes, siteMarginRes, searchConsoleRes, analyticsRes] = await Promise.all([
          fetch("/api/hubspot/deals"),
          fetch("/api/focably/metrics"),
          fetch("/api/sitemargin/metrics"),
          fetch("/api/google/search-console"),
          fetch("/api/google/analytics"),
        ]);

        const kpisData: DealKPIs = await kpisRes.json();
        const focablyData: FocablyMetrics = await focablyRes.json();
        const siteMarginData: SiteMarginMetrics = await siteMarginRes.json();
        const searchConsoleData: SearchConsoleMetrics = await searchConsoleRes.json();
        const analyticsData: AnalyticsMetrics = await analyticsRes.json();

        setKpis(kpisData);
        setFocablyMetrics(focablyData);
        setSiteMarginMetrics(siteMarginData);
        setSearchConsoleMetrics(searchConsoleData);
        setAnalyticsMetrics(analyticsData);
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
          currentMonthMRR: 0,
          currentMonthARR: 0,
          lastUpdated: new Date().toISOString(),
          error: "Failed to load Focably metrics",
        });
        setSiteMarginMetrics({
          totalOrganizations: 0,
          activeTrials: 0,
          activeSubscriptions: 0,
          trialConversionRate: 0,
          canceledOrganizations: 0,
          pastDueOrganizations: 0,
          paidChurnThisMonth: 0,
          untrialChurnThisMonth: 0,
          currentMonthMRR: 0,
          currentMonthARR: 0,
          lastUpdated: new Date().toISOString(),
          error: "Failed to load SiteMargin metrics",
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
      const [kpisRes, focablyRes, siteMarginRes, searchConsoleRes, analyticsRes] = await Promise.all([
        fetch("/api/hubspot/deals", { method: "POST" }),
        fetch("/api/focably/metrics"),
        fetch("/api/sitemargin/metrics"),
        fetch("/api/google/search-console"),
        fetch("/api/google/analytics"),
      ]);

      const kpisData: DealKPIs = await kpisRes.json();
      const focablyData: FocablyMetrics = await focablyRes.json();
      const siteMarginData: SiteMarginMetrics = await siteMarginRes.json();
      const searchConsoleData: SearchConsoleMetrics = await searchConsoleRes.json();
      const analyticsData: AnalyticsMetrics = await analyticsRes.json();

      setKpis(kpisData);
      setFocablyMetrics(focablyData);
      setSiteMarginMetrics(siteMarginData);
      setSearchConsoleMetrics(searchConsoleData);
      setAnalyticsMetrics(analyticsData);
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

      {(kpis?.error || focablyMetrics?.error || siteMarginMetrics?.error || searchConsoleMetrics?.error || analyticsMetrics?.error) && (
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
          ⚠️ {kpis?.error || focablyMetrics?.error || siteMarginMetrics?.error || searchConsoleMetrics?.error || analyticsMetrics?.error}
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
        {/* Web Metrics */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">Web Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* SiteMargin Search Console */}
          {searchConsoleMetrics?.siteMargin ? (
            <SearchConsoleMetricsTile
              businessName="SiteMargin"
              clicks={searchConsoleMetrics.siteMargin.clicks}
              impressions={searchConsoleMetrics.siteMargin.impressions}
              ctr={searchConsoleMetrics.siteMargin.ctr}
              avgPosition={searchConsoleMetrics.siteMargin.avgPosition}
              topQueries={searchConsoleMetrics.siteMargin.topQueries}
              isLoading={loading}
            />
          ) : (
            <SearchConsoleMetricsTile
              businessName="SiteMargin"
              clicks={0}
              impressions={0}
              ctr={0}
              avgPosition={0}
              isLoading={true}
            />
          )}

          {/* SiteMargin Analytics */}
          {analyticsMetrics?.siteMargin ? (
            <AnalyticsMetricsTile
              businessName="SiteMargin"
              sessions={analyticsMetrics.siteMargin.sessions}
              users={analyticsMetrics.siteMargin.users}
              pageviews={analyticsMetrics.siteMargin.pageviews}
              bounceRate={analyticsMetrics.siteMargin.bounceRate}
              isLoading={loading}
            />
          ) : (
            <AnalyticsMetricsTile
              businessName="SiteMargin"
              sessions={0}
              users={0}
              pageviews={0}
              bounceRate={0}
              isLoading={true}
            />
          )}
        </div>
      </div>

      <div>
        {/* Subscription Metrics */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">User & Churn Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
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
              currentMonthMRR={focablyMetrics.currentMonthMRR}
              currentMonthARR={focablyMetrics.currentMonthARR}
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
              currentMonthMRR={0}
              currentMonthARR={0}
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
              currentMonthMRR={siteMarginMetrics.currentMonthMRR}
              currentMonthARR={siteMarginMetrics.currentMonthARR}
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
              currentMonthMRR={0}
              currentMonthARR={0}
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
