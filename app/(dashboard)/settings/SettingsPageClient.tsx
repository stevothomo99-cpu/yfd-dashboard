"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { initialsOf } from "@/lib/utils";
import { linkKarbonToXpmByEmail } from "@/lib/staffLink";
import type { XpmStaff } from "@/types/xpm";
import type { SettingsSnapshot } from "./page";

interface XpmStaffResponse {
  mode: "live" | "mock";
  partnerName: string;
  staff: XpmStaff[];
  syncedAt: string;
  message?: string;
}

interface WorkflowSyncResult {
  partnerName: string;
  staffUpserted: number;
  staffRemoved: number;
  customersUpserted: number;
  customersRemoved: number;
  jobsUpserted: number;
  jobsRemoved: number;
}

export default function SettingsPageClient({ initial }: { initial: SettingsSnapshot }) {
  const [partnerName, setPartnerName] = useState(initial.partnerName);
  const [snapshot, setSnapshot] = useState(initial);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [workflowSyncing, setWorkflowSyncing] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowSyncResult | null>(null);

  async function persistExclusions(roster: SettingsSnapshot["roster"]) {
    const excludedStaffIds = roster
      .filter((r) => !r.included)
      .flatMap((r) => (r.xpmId ? [r.karbonId, r.xpmId] : [r.karbonId]));

    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ excludedStaffIds }),
    });
    if (!res.ok) throw new Error("Failed to save.");
  }

  async function handleToggle(karbonId: string) {
    const nextRoster = snapshot.roster.map((r) =>
      r.karbonId === karbonId ? { ...r, included: !r.included } : r,
    );
    setSnapshot({ ...snapshot, roster: nextRoster });
    setError(null);

    try {
      await persistExclusions(nextRoster);
    } catch {
      setSnapshot((prev) => ({
        ...prev,
        roster: prev.roster.map((r) => (r.karbonId === karbonId ? { ...r, included: !r.included } : r)),
      }));
      setError("Couldn't save that change — try again.");
    }
  }

  async function handleSync() {
    setSyncing(true);
    setError(null);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerName }),
      });
      const res = await fetch("/api/xpm/staff", { method: "POST" });
      const body: XpmStaffResponse = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Sync failed.");

      // Re-link the existing Karbon roster against fresh XPM data, carrying
      // each person's current included/excluded state across the re-sync.
      const includedByKarbonId = new Map(snapshot.roster.map((r) => [r.karbonId, r.included]));
      const relinked = linkKarbonToXpmByEmail(
        snapshot.roster.map((r) => ({ id: r.karbonId, name: r.name, email: r.email })),
        body.staff,
      );
      const nextRoster = relinked.map((l) => ({
        ...l,
        included: includedByKarbonId.get(l.karbonId) ?? true,
      }));

      setSnapshot({
        ...snapshot,
        xpmMode: body.mode,
        xpmMessage: body.message,
        roster: nextRoster,
        syncedAt: body.syncedAt,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleWorkflowSync() {
    setWorkflowSyncing(true);
    setWorkflowError(null);
    try {
      const res = await fetch("/api/xpm/sync-workflow", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Sync failed.");
      setWorkflowResult(body as WorkflowSyncResult);
    } catch (err) {
      setWorkflowError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setWorkflowSyncing(false);
    }
  }

  const includedCount = snapshot.roster.filter((r) => r.included).length;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure the XPM Partner filter and which staff appear across the dashboard"
      />

      <div className="mb-6 flex gap-4">
        <button className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium">
          Staff & Sync
        </button>
        <Link href="/settings/users">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            Dashboard Users
          </button>
        </Link>
        <Link href="/settings/security">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            My Security
          </button>
        </Link>
      </div>

      {snapshot.karbonMode === "mock" ? (
        <Banner tone="warn">Karbon roster: showing mock data — {snapshot.karbonMessage ?? "Karbon is not configured."}</Banner>
      ) : null}

      {snapshot.xpmMode === "mock" ? (
        <Banner tone="warn">XPM staff: showing mock data — {snapshot.xpmMessage ?? "XPM is not configured."}</Banner>
      ) : null}

      {snapshot.xpmMode === "live" && snapshot.xpmMessage ? (
        <Banner tone="info">{snapshot.xpmMessage}</Banner>
      ) : null}

      {error ? <Banner tone="error">{error}</Banner> : null}

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.4rem 1.5rem",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "4px" }}>
          XPM Partner filter
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "16px" }}>
          Only jobs where Partner = this exact name are included. Staff returned with Manager role on
          those jobs are matched to the Karbon roster below by email.
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "stretch", flexWrap: "wrap" }}>
          <input
            type="text"
            value={partnerName}
            onChange={(e) => setPartnerName(e.target.value)}
            placeholder="e.g. Steve Thompson"
            style={{
              flex: 1,
              minWidth: "240px",
              fontSize: "13px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "0.5px solid #e1e0d9",
              background: "white",
              color: "#111111",
              outline: "none",
            }}
          />
          <button
            type="button"
            disabled={!partnerName.trim() || syncing}
            onClick={handleSync}
            style={{
              fontSize: "13px",
              fontWeight: 500,
              padding: "10px 22px",
              borderRadius: "8px",
              background: !partnerName.trim() || syncing ? "#b4b2a9" : "#2a78d6",
              color: "white",
              border: "none",
              cursor: !partnerName.trim() || syncing ? "not-allowed" : "pointer",
            }}
          >
            {syncing ? "Syncing…" : "Sync from XPM"}
          </button>
        </div>

        <div style={{ fontSize: "11px", color: "#27500A", marginTop: "10px" }}>
          ✓ Last synced at{" "}
          {new Date(snapshot.syncedAt).toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" })}
        </div>
      </div>

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.4rem 1.5rem",
          marginBottom: "14px",
        }}
      >
        <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "4px" }}>
          Live workflow data
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "16px" }}>
          Replaces the staff/client/job records that power My Work, Clients, and Dashboard with the
          Partner filter&rsquo;s current XPM data. Dashboard tasks aren&rsquo;t touched, except that a
          job leaving the in-progress list takes its tasks with it.
        </div>

        {workflowError ? <Banner tone="error">{workflowError}</Banner> : null}

        <button
          type="button"
          disabled={!partnerName.trim() || workflowSyncing}
          onClick={handleWorkflowSync}
          style={{
            fontSize: "13px",
            fontWeight: 500,
            padding: "10px 22px",
            borderRadius: "8px",
            background: !partnerName.trim() || workflowSyncing ? "#b4b2a9" : "#2a78d6",
            color: "white",
            border: "none",
            cursor: !partnerName.trim() || workflowSyncing ? "not-allowed" : "pointer",
          }}
        >
          {workflowSyncing ? "Syncing…" : "Sync workflow data from XPM"}
        </button>

        {workflowResult ? (
          <div style={{ fontSize: "11px", color: "#27500A", marginTop: "10px" }}>
            ✓ Staff {workflowResult.staffUpserted} synced / {workflowResult.staffRemoved} removed &middot;
            Clients {workflowResult.customersUpserted} synced / {workflowResult.customersRemoved} removed
            &middot; Jobs {workflowResult.jobsUpserted} synced / {workflowResult.jobsRemoved} removed
          </div>
        ) : null}
      </div>

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.4rem 1.5rem",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "4px",
          }}
        >
          <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>Included staff</div>
          <div style={{ fontSize: "11px", color: "#888780" }}>
            {includedCount} of {snapshot.roster.length} active
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "16px" }}>
          Roster comes from Karbon. Toggle who appears in dashboards and slicers — excluded staff are
          hidden everywhere. &ldquo;Linked&rdquo; means a Karbon and XPM record share the same email.
        </div>

        {snapshot.roster.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>
            No staff found in Karbon.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {snapshot.roster.map((r, i) => (
              <div
                key={r.karbonId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: i < snapshot.roster.length - 1 ? "0.5px solid #e1e0d9" : "none",
                }}
              >
                <StaffAvatar initials={initialsOf(r.name)} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{r.name}</div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                    {r.email || "No email on file"}
                  </div>
                </div>
                <div
                  style={{
                    fontSize: "10px",
                    padding: "3px 9px",
                    borderRadius: "8px",
                    fontWeight: 500,
                    background: r.xpmId ? "#EAF3DE" : "#f5f4f0",
                    color: r.xpmId ? "#27500A" : "#888780",
                    whiteSpace: "nowrap",
                  }}
                >
                  {r.xpmId ? `Linked · ${r.xpmName}` : "Not linked to XPM"}
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(r.karbonId)}
                  aria-pressed={r.included}
                  style={{
                    position: "relative",
                    width: "40px",
                    height: "22px",
                    borderRadius: "999px",
                    background: r.included ? "#1baf7a" : "#d3d2cb",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "background 0.15s",
                    flexShrink: 0,
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: r.included ? "20px" : "2px",
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      background: "white",
                      transition: "left 0.15s",
                      boxShadow: "0 1px 2px rgba(0,0,0,0.15)",
                    }}
                  />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Banner({ tone, children }: { tone: "warn" | "info" | "error"; children: React.ReactNode }) {
  const styles = {
    warn: { color: "#633806", background: "#FAEEDA", border: "#f0d9a8" },
    info: { color: "#0C447C", background: "#E6F1FB", border: "#b9d8f2" },
    error: { color: "#501313", background: "#FCEBEB", border: "#f0b8b8" },
  }[tone];
  return (
    <div
      style={{
        fontSize: "12px",
        color: styles.color,
        background: styles.background,
        border: `0.5px solid ${styles.border}`,
        borderRadius: "10px",
        padding: "8px 12px",
        marginBottom: "12px",
      }}
    >
      {children}
    </div>
  );
}
