"use client";

import { useState } from "react";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { initialsOf } from "@/lib/utils";
import type { SettingsSnapshot } from "./page";

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
  const partnerOptions = initial.partnerOptions;
  const [partnerName, setPartnerName] = useState(initial.partnerName);
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const [workflowSyncing, setWorkflowSyncing] = useState(false);
  const [workflowError, setWorkflowError] = useState<string | null>(null);
  const [workflowResult, setWorkflowResult] = useState<WorkflowSyncResult | null>(null);

  // Optimistic, then reverted on failure -- a toggle that appears to work and
  // silently didn't would be worse here than a brief flicker, since the
  // consequence is invisible until someone reads a utilisation figure.
  async function handleToggle(staffId: string) {
    const flip = (roster: SettingsSnapshot["roster"]) =>
      roster.map((r) => (r.id === staffId ? { ...r, included: !r.included } : r));
    const next = flip(snapshot.roster);
    const target = next.find((r) => r.id === staffId);
    setSnapshot({ ...snapshot, roster: next });
    setError(null);

    try {
      const res = await fetch("/api/workflow/staff", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ staffId, included: target?.included ?? true }),
      });
      if (!res.ok) throw new Error("Failed to save.");
    } catch {
      setSnapshot((prev) => ({ ...prev, roster: flip(prev.roster) }));
      setError("Couldn't save that change — try again.");
    }
  }

  // Saves the Partner first, then resyncs. Previously this only resynced --
  // so changing the Partner and pressing it discarded the change and rebuilt
  // everything against the *old* Partner, with no indication anything had been
  // ignored. Only the staff-roster button persisted the field, which is not
  // where anyone would look for it.
  async function handleWorkflowSync() {
    setWorkflowSyncing(true);
    setWorkflowError(null);
    try {
      const saved = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerName }),
      });
      if (!saved.ok) throw new Error("Couldn't save the Partner filter.");

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

      {snapshot.rosterMessage ? <Banner tone="info">{snapshot.rosterMessage}</Banner> : null}

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
          Only clients whose XPM <strong>Account Manager</strong> is this person are included, along
          with their jobs. Each job&rsquo;s XPM <strong>Job Manager</strong> becomes the Manager you
          filter by on Clients and My Work. Saving rebuilds the client, job and staff records behind
          My Work, Clients, Timesheets and Dashboard, and clears the cached timesheet data.
          {partnerOptions.length === 0
            ? " Listing Account Managers from XPM isn't available right now, so this is a free-text field -- it must match an XPM staff name exactly."
            : ""}
        </div>

        <div style={{ display: "flex", gap: "10px", alignItems: "stretch", flexWrap: "wrap" }}>
          {partnerOptions.length > 0 ? (
            <select
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              aria-label="XPM Partner"
              style={partnerFieldStyle}
            >
              <option value="">Select a Partner…</option>
              {partnerOptions.map((p) => (
                <option key={p.name} value={p.name}>
                  {p.name} ({p.clientCount} client{p.clientCount === 1 ? "" : "s"})
                </option>
              ))}
              {/* Keep whatever is currently saved selectable even if XPM no
                  longer lists it -- otherwise opening this page would
                  silently offer to change a working setting. */}
              {partnerName && !partnerOptions.some((p) => p.name === partnerName) ? (
                <option value={partnerName}>{partnerName} (saved -- not an Account Manager in XPM)</option>
              ) : null}
            </select>
          ) : (
            <input
              type="text"
              value={partnerName}
              onChange={(e) => setPartnerName(e.target.value)}
              placeholder="e.g. Steve Thomas"
              style={partnerFieldStyle}
            />
          )}
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
              whiteSpace: "nowrap",
            }}
          >
            {workflowSyncing ? "Saving & resyncing…" : "Save & resync clients, jobs, staff"}
          </button>
        </div>

        {workflowError ? <Banner tone="error">{workflowError}</Banner> : null}
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
            {includedCount} of {snapshot.roster.length} included
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "16px" }}>
          Synced from XPM by <em>Save &amp; resync</em> above. Excluding someone removes them from the
          Timesheets figures (both their hours <strong>and</strong> their 38hr capacity), the Clients
          staff slicer, and the My Work staff switcher. They can still be assigned tasks, and their
          time stays in XPM &mdash; this only governs what the dashboard reports on.
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {snapshot.roster.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>
            No staff synced from XPM yet.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {snapshot.roster.map((r, i) => (
              <div
                key={r.id}
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
                <div style={{ fontSize: "11px", color: "#888780", whiteSpace: "nowrap" }}>{r.role}</div>
                <button
                  type="button"
                  onClick={() => handleToggle(r.id)}
                  aria-pressed={r.included}
                  aria-label={`${r.included ? "Exclude" : "Include"} ${r.name}`}
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

        {/* The Partner, listed without a toggle. They're already out of the
            practice-wide figures by role (see timesheets/page.tsx) and they're
            set by the field above, so a switch here would imply a control that
            does nothing. Omitting the row altogether just reads as a missing
            person. */}
        {snapshot.partnerRoster.length > 0 ? (
          <div
            style={{
              marginTop: "16px",
              paddingTop: "14px",
              borderTop: "0.5px solid #e1e0d9",
            }}
          >
            <div style={{ fontSize: "11px", color: "#888780", marginBottom: "10px" }}>
              Set by the Partner filter above, and always out of the practice-wide Timesheets
              figures — a Partner carries no delivery workload, so their 38hr week in the
              denominator would understate everyone else. Their own hours still show in the By
              employee table.
            </div>
            {snapshot.partnerRoster.map((r) => (
              <div key={r.id} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
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
                    background: "#f5f4f0",
                    color: "#888780",
                    whiteSpace: "nowrap",
                  }}
                >
                  Partner
                </div>
              </div>
            ))}
          </div>
        ) : null}
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

const partnerFieldStyle: React.CSSProperties = {
  flex: 1,
  minWidth: "240px",
  fontSize: "13px",
  padding: "10px 14px",
  borderRadius: "8px",
  border: "0.5px solid #e1e0d9",
  background: "white",
  color: "#111111",
  outline: "none",
  fontFamily: "inherit",
};
