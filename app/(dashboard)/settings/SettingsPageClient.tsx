"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { initialsOf } from "@/lib/utils";
import type { StaffSnapshot } from "./page";

export default function SettingsPageClient({ initialStaff }: { initialStaff: StaffSnapshot }) {
  const [partnerName, setPartnerName] = useState(initialStaff.partnerName);
  const [snapshot, setSnapshot] = useState(initialStaff);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      const body: StaffSnapshot = await res.json();
      if (!res.ok) throw new Error(body.message ?? "Sync failed.");
      setSnapshot(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sync failed.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleToggle(id: string) {
    const nextStaff = snapshot.staff.map((s) => (s.id === id ? { ...s, included: !s.included } : s));
    setSnapshot({ ...snapshot, staff: nextStaff });
    setError(null);

    const excludedStaffIds = nextStaff.filter((s) => !s.included).map((s) => s.id);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ excludedStaffIds }),
      });
      if (!res.ok) throw new Error("Failed to save.");
    } catch {
      // Revert the optimistic toggle if the save didn't stick.
      setSnapshot((prev) => ({
        ...prev,
        staff: prev.staff.map((s) => (s.id === id ? { ...s, included: !s.included } : s)),
      }));
      setError("Couldn't save that change — try again.");
    }
  }

  const includedCount = snapshot.staff.filter((s) => s.included).length;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure the XPM Partner filter and which staff appear across the dashboard"
      />

      {snapshot.mode === "mock" ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          Showing mock data — {snapshot.message ?? "XPM is not configured."}
        </div>
      ) : null}

      {snapshot.mode === "live" && snapshot.message ? (
        <div
          style={{
            fontSize: "12px",
            color: "#0C447C",
            background: "#E6F1FB",
            border: "0.5px solid #b9d8f2",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          {snapshot.message}
        </div>
      ) : null}

      {error ? (
        <div
          style={{
            fontSize: "12px",
            color: "#501313",
            background: "#FCEBEB",
            border: "0.5px solid #f0b8b8",
            borderRadius: "10px",
            padding: "8px 12px",
            marginBottom: "12px",
          }}
        >
          {error}
        </div>
      ) : null}

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
          those jobs become the YFD team.
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
            {includedCount} of {snapshot.staff.length} active
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "16px" }}>
          Toggle who appears in dashboards and slicers. Excluded staff are hidden everywhere.
        </div>

        {snapshot.staff.length === 0 ? (
          <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>
            No staff yet — set a Partner name and sync.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {snapshot.staff.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: i < snapshot.staff.length - 1 ? "0.5px solid #e1e0d9" : "none",
                }}
              >
                <StaffAvatar initials={initialsOf(s.name)} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{s.name}</div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>{s.role}</div>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(s.id)}
                  aria-pressed={s.included}
                  style={{
                    position: "relative",
                    width: "40px",
                    height: "22px",
                    borderRadius: "999px",
                    background: s.included ? "#1baf7a" : "#d3d2cb",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    transition: "background 0.15s",
                  }}
                >
                  <span
                    style={{
                      position: "absolute",
                      top: "2px",
                      left: s.included ? "20px" : "2px",
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
