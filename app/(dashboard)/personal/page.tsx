"use client";

import { useEffect, useState } from "react";
import { BusinessKpiTile } from "@/components/dashboard/BusinessKpiTile";
import { SubscriptionMetricsTile } from "@/components/dashboard/SubscriptionMetricsTile";
import { SiteMarginMetricsTile } from "@/components/dashboard/SiteMarginMetricsTile";
import { WebMetricsTile } from "@/components/dashboard/WebMetricsTile";
import PageHeader from "@/components/dashboard/PageHeader";

interface XeroSalesMetrics {
  monthTotal: number;
  fyTotal: number;
  monthHours: number;
  fyHours: number;
  error?: string;
}

function fmtPerHour(total: number, hours: number): string {
  if (!hours) return "—";
  return `$${Math.round(total / hours).toLocaleString("en-AU")}/hr`;
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

export default function PersonalDashboard() {
  const [kpis, setKpis] = useState<DealKPIs | null>(null);
  const [xeroSales, setXeroSales] = useState<XeroSalesMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [kpisRes, xeroRes] = await Promise.all([
          fetch("/api/hubspot/deals"),
          fetch("/api/xero-accounting/sales"),
        ]);

        const kpisData: DealKPIs = await kpisRes.json();
        const xeroData: XeroSalesMetrics = await xeroRes.json();

        setKpis(kpisData);
        setXeroSales(xeroData);
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
      const [kpisRes, xeroRes] = await Promise.all([
        fetch("/api/hubspot/deals", { method: "POST" }),
        fetch("/api/xero-accounting/sales", { method: "POST" }),
      ]);

      const kpisData: DealKPIs = await kpisRes.json();
      const xeroData: XeroSalesMetrics = await xeroRes.json();

      setKpis(kpisData);
      setXeroSales(xeroData);
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Month Total</p>
                  <p className="text-2xl font-bold">
                    {loading ? "..." : xeroSales?.monthTotal ? `$${(xeroSales.monthTotal / 1000).toFixed(1)}k` : "$0"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">FY Total</p>
                  <p className="text-2xl font-bold">
                    {loading ? "..." : xeroSales?.fyTotal ? `$${(xeroSales.fyTotal / 1000).toFixed(1)}k` : "$0"}
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Hours Logged (Month)</p>
                  <p className="text-2xl font-bold">{loading ? "..." : (xeroSales?.monthHours ?? 0).toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Hours Logged (FY)</p>
                  <p className="text-2xl font-bold">{loading ? "..." : (xeroSales?.fyHours ?? 0).toFixed(1)}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">$/hr (Month)</p>
                  <p className="text-2xl font-bold">
                    {loading ? "..." : fmtPerHour(xeroSales?.monthTotal ?? 0, xeroSales?.monthHours ?? 0)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">$/hr (FY)</p>
                  <p className="text-2xl font-bold">
                    {loading ? "..." : fmtPerHour(xeroSales?.fyTotal ?? 0, xeroSales?.fyHours ?? 0)}
                  </p>
                </div>
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
        <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">Web Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <WebMetricsTile productKey="siteMargin" productName="SiteMargin" />
          <WebMetricsTile productKey="focablyED" productName="FocablyED" />
          <WebMetricsTile productKey="yfd" productName="YFD" />
        </div>
      </div>

      <div>
        {/* Subscription Metrics */}
        <h2 className="text-xl font-semibold text-gray-900 mb-4 mt-8">
          User & Churn Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <SubscriptionMetricsTile businessName="FocablyED" />
          <SiteMarginMetricsTile businessName="SiteMargin" />
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

      {kpis?.lastUpdated && (
        <p className="text-xs text-gray-500 mt-4">
          Last updated: {new Date(kpis.lastUpdated).toLocaleString()}
        </p>
      )}
    </div>
  );
}
