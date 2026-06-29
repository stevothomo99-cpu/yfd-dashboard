"use client";

import { useState } from "react";
import PageHeader from "@/components/dashboard/PageHeader";
import StaffAvatar from "@/components/dashboard/StaffAvatar";
import { STAFF } from "@/lib/mock";

export default function SettingsPage() {
  const [partnerName, setPartnerName] = useState("");
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  const [included, setIncluded] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(STAFF.map((s) => [s.id, s.included])),
  );

  function toggle(id: string) {
    setIncluded((prev) => ({ ...prev, [id]: !prev[id] }));
  }

  function sync() {
    setSyncing(true);
    setTimeout(() => {
      setSyncing(false);
      setSyncedAt(new Date().toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit" }));
    }, 800);
  }

  const includedCount = Object.values(included).filter(Boolean).length;

  return (
    <div>
      <PageHeader
        title="Settings"
        subtitle="Configure the XPM Partner filter and which staff appear across the dashboard"
      />

      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "1.4rem 1.5rem",
          marginTop: "14px",
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
            onClick={sync}
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

        {syncedAt ? (
          <div style={{ fontSize: "11px", color: "#27500A", marginTop: "10px" }}>
            ✓ Last synced at {syncedAt}. Staff list refreshed below.
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
            {includedCount} of {STAFF.length} active
          </div>
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginBottom: "16px" }}>
          Toggle who appears in dashboards and slicers. Excluded staff are hidden everywhere.
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          {STAFF.map((s, i) => {
            const on = included[s.id];
            return (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "12px 0",
                  borderBottom: i < STAFF.length - 1 ? "0.5px solid #e1e0d9" : "none",
                }}
              >
                <StaffAvatar initials={s.initials} size={32} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111" }}>{s.name}</div>
                  <div style={{ fontSize: "11px", color: "#888780", marginTop: "2px" }}>
                    {s.xpmRole}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggle(s.id)}
                  aria-pressed={on}
                  style={{
                    position: "relative",
                    width: "40px",
                    height: "22px",
                    borderRadius: "999px",
                    background: on ? "#1baf7a" : "#d3d2cb",
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
                      left: on ? "20px" : "2px",
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
            );
          })}
        </div>
      </div>

      <div style={{ fontSize: "11px", color: "#888780", marginTop: "14px", textAlign: "center" }}>
        Persistence to Vercel KV will be wired in Phase 1 · Week 2.
      </div>
    </div>
  );
}
