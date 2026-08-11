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
  const [showPartnersError, setShowPartnersError] = useState<string | null>(null);

  // Optimistic like handleToggle above, for the same reason: a toggle that
  // looks like it worked and silently didn't would only surface later, as an
  // unexplained row appearing or disappearing from Timesheets.
  async function handleToggleShowPartners() {
    const next = !snapshot.showPartnersInTimesheets;
    setSnapshot((prev) => ({ ...prev, showPartnersInTimesheets: next }));
    setShowPartnersError(null);

    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ showPartnersInTimesheets: next }),
      });
      if (!res.ok) throw new Error("Failed to save.");
    } catch {
      setSnapshot((prev) => ({ ...prev, showPartnersInTimesheets: !next }));
      setShowPartnersError("Couldn't save that change — try again.");
    }
  }

  // The row is a dashboard login, but the thing being toggled is the XPM
  // staff record matched to it by email -- that's what carries the hours.
  //
  // Optimistic, then reverted on failure: a toggle that appears to work and
  // silently didn't would be worse here than a brief flicker, since the
  // consequence is invisible until someone reads a utilisation figure.
  async function handleToggle(userId: string, staffId: string) {
    const flip = (roster: SettingsSnapshot["roster"]) =>
      roster.map((r) => (r.userId === userId ? { ...r, included: !r.included } : r));
    const next = flip(snapshot.roster);
    const target = next.find((r) => r.userId === userId);
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

  // Counted over rows that actually have an XPM match -- a login with no
  // matching staff record has no hours either way, so counting it would
  // overstate how many people the figures cover.
  const matchedRoster = snapshot.roster.filter((r) => r.staffId);
  const includedCount = matchedRoster.filter((r) => r.included).length;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure the XPM Partner filter and which staff the dashboard reports on"
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
        <Link href="/settings/karbon-import">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            Karbon Import
          </button>
        </Link>
        <Link href="/settings/email-schedule">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            Email Schedule
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
            {includedCount} of {matchedRoster.length} included
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "10px" }}>
          The list is your <Link href="/settings/users" style={linkStyle}>Dashboard Users</Link>, matched
          to XPM by email. Excluding someone removes them from the Timesheets figures (both their hours{" "}
          <strong>and</strong> their 38hr capacity), the Clients staff slicer, and the My Work staff
          switcher. They can still be assigned tasks, and their time stays in XPM &mdash; this only
          governs what the dashboard reports on.
        </div>
        <div style={{ fontSize: "12px", color: "#633806", background: "#FAEEDA", border: "0.5px solid #f0d9a8", borderRadius: "10px", padding: "8px 12px", marginBottom: "16px" }}>
          A Dashboard User&rsquo;s email <strong>must match their XPM staff email exactly</strong> (case
          doesn&rsquo;t matter). That email is the only link between the two &mdash; if it differs,
          their XPM hours can&rsquo;t be attributed to them here and there&rsquo;s nothing to toggle.
        </div>

        {error ? <Banner tone="error">{error}</Banner> : null}

        {snapshot.roster.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>
            No dashboard users yet — add them under Dashboard Users.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {snapshot.roster.map((r, i) => (
              <div
                key={r.userId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: i < snapshot.roster.length - 1 ? "0.5px solid #e1e0d9" : "none",
                }}
              >
                <StaffAvatar initials={initialsOf(r.staffName ?? r.username)} size={32} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
                    {r.staffName ?? r.username}
                    {r.isAdmin ? (
                      <span style={{ fontSize: "10px", color: "#888780", fontWeight: 400, marginLeft: "6px" }}>
                        admin
                      </span>
                    ) : null}
                    {r.suspended ? (
                      <span style={{ fontSize: "10px", color: "#888780", fontWeight: 400, marginLeft: "6px" }}>
                        · login paused
                      </span>
                    ) : null}
                  </div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>{r.email}</div>
                </div>

                {/* No XPM match means no hours to include or exclude, so the
                    toggle is replaced by the reason rather than shown doing
                    nothing. */}
                {r.staffId ? (
                  <>
                    <div style={{ fontSize: "11px", color: "#888780", whiteSpace: "nowrap" }}>
                      {r.staffRole}
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggle(r.userId, r.staffId as string)}
                      aria-pressed={r.included}
                      aria-label={`${r.included ? "Exclude" : "Include"} ${r.staffName ?? r.username}`}
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
                  </>
                ) : (
                  <div
                    style={{
                      fontSize: "10px",
                      padding: "3px 9px",
                      borderRadius: "8px",
                      fontWeight: 500,
                      background: "#FAEEDA",
                      color: "#633806",
                      whiteSpace: "nowrap",
                    }}
                  >
                    No XPM staff with this email
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* The other side of the email join: someone in XPM with no login
            here. They keep counting in every figure and there's no row to
            switch them off from, which is worth saying out loud. */}
        {snapshot.unmatchedStaffNames.length > 0 ? (
          <div
            style={{
              fontSize: "11px",
              color: "#633806",
              background: "#FAEEDA",
              border: "0.5px solid #f0d9a8",
              borderRadius: "10px",
              padding: "8px 12px",
              marginTop: "14px",
            }}
          >
            In XPM but with no Dashboard User:{" "}
            <strong>{snapshot.unmatchedStaffNames.join(", ")}</strong>. They stay included in every
            figure and can&rsquo;t be toggled from here — add a Dashboard User with the same email to
            get a switch for them.
          </div>
        ) : null}

        {/* The Partner, listed without the per-person Included toggle (that
            one is set by the field above, so a switch here would imply a
            control that does nothing) but with the separate Show Partners on
            Timesheets toggle below, which controls whether they appear as a
            row at all. */}
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
              denominator would understate everyone else. Whether their own hours still show as a
              row in the By employee table is controlled below.
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                padding: "10px 0",
                marginBottom: "6px",
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
                  Show Partners on Timesheets
                </div>
                <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                  Partners already don&rsquo;t count toward practice utilisation — this controls
                  whether they still show up as a row in the By employee table.
                </div>
              </div>
              <button
                type="button"
                onClick={handleToggleShowPartners}
                aria-pressed={snapshot.showPartnersInTimesheets}
                aria-label={`${snapshot.showPartnersInTimesheets ? "Hide" : "Show"} Partners on Timesheets`}
                style={{
                  position: "relative",
                  width: "40px",
                  height: "22px",
                  borderRadius: "999px",
                  background: snapshot.showPartnersInTimesheets ? "#1baf7a" : "#d3d2cb",
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
                    left: snapshot.showPartnersInTimesheets ? "20px" : "2px",
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
            {showPartnersError ? <Banner tone="error">{showPartnersError}</Banner> : null}

            {snapshot.partnerRoster.map((r) => (
              <div key={r.userId} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                <StaffAvatar initials={initialsOf(r.staffName ?? r.username)} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>
                    {r.staffName ?? r.username}
                  </div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>{r.email}</div>
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

const linkStyle: React.CSSProperties = {
  color: "#2a78d6",
  textDecoration: "underline",
};

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
