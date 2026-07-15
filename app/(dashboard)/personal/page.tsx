"use client";

import { useEffect, useState } from "react";
import { BusinessKpiTile } from "@/components/dashboard/BusinessKpiTile";
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

export default function PersonalDashboard() {
  const [kpis, setKpis] = useState<DealKPIs | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchKpis = async () => {
      try {
        const res = await fetch("/api/hubspot/deals");
        const data: DealKPIs = await res.json();
        setKpis(data);
      } catch (err) {
        console.error("Failed to fetch HubSpot KPIs:", err);
        setKpis({
          focablyED: null,
          siteMargin: null,
          error: "Failed to load HubSpot data",
          lastUpdated: new Date().toISOString(),
        });
      } finally {
        setLoading(false);
      }
    };

    fetchKpis();
  }, []);

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/hubspot/deals", { method: "POST" });
      const data: DealKPIs = await res.json();
      setKpis(data);
    } catch (err) {
      console.error("Failed to refresh KPIs:", err);
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

      {kpis?.error && (
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
          ⚠️ {kpis.error}
        </div>
      )}

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
