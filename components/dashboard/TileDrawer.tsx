"use client";

import { useEffect } from "react";
import BasStatusBadge from "./BasStatusBadge";
import StaffAvatar from "./StaffAvatar";
import TaskRow from "./TaskRow";
import { fmtCurrency, initialsOf } from "@/lib/utils";
import type { ClientTile as ClientTileType } from "@/types/dashboard";

interface Props {
  tile: ClientTileType | null;
  onClose: () => void;
}

export default function TileDrawer({ tile, onClose }: Props) {
  useEffect(() => {
    if (!tile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [tile, onClose]);

  if (!tile) return null;

  const total = tile.revenueBreakdown.reduce((acc, r) => acc + r.value, 0);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17, 17, 17, 0.35)",
        zIndex: 100,
        display: "flex",
        justifyContent: "flex-end",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "520px",
          background: "white",
          height: "100%",
          overflow: "auto",
          padding: "1.5rem 1.5rem 3rem",
          boxShadow: "-8px 0 24px rgba(0,0,0,0.06)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: "20px",
          }}
        >
          <div>
            <div style={{ fontSize: "18px", fontWeight: 600, color: "#111111" }}>{tile.name}</div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                marginTop: "6px",
              }}
            >
              <StaffAvatar initials={initialsOf(tile.managerName)} size={22} />
              <span style={{ fontSize: "12px", color: "#444441" }}>{tile.managerName}</span>
              <span style={{ fontSize: "12px", color: "#888780", margin: "0 4px" }}>·</span>
              <BasStatusBadge status={tile.basStatus} />
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              fontSize: "22px",
              color: "#888780",
              cursor: "pointer",
              lineHeight: 1,
              padding: "4px 8px",
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <Section title={`Overdue · ${tile.overdueTasks.length}`}>
          {tile.overdueTasks.length === 0 ? (
            <Empty label="No overdue tasks." />
          ) : (
            <Stack>
              {tile.overdueTasks.map((t) => (
                <TaskRow key={t.id} task={t} accent="overdue" showClient={false} />
              ))}
            </Stack>
          )}
        </Section>

        <Section title={`In progress · ${tile.inProgressTasks.length}`}>
          {tile.inProgressTasks.length === 0 ? (
            <Empty label="Nothing in progress." />
          ) : (
            <Stack>
              {tile.inProgressTasks.map((t) => (
                <TaskRow key={t.id} task={t} accent="week" showClient={false} />
              ))}
            </Stack>
          )}
        </Section>

        <Section title={`Completed this week · ${tile.completedTasks.length}`}>
          {tile.completedTasks.length === 0 ? (
            <Empty label="No completed tasks this week." />
          ) : (
            <Stack>
              {tile.completedTasks.map((t) => (
                <TaskRow key={t.id} task={t} accent="done" showClient={false} />
              ))}
            </Stack>
          )}
        </Section>

        <Section title="YTD revenue breakdown">
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {tile.revenueBreakdown.map((r) => {
              const pct = total > 0 ? Math.round((r.value / total) * 100) : 0;
              return (
                <div key={r.label}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "baseline",
                      fontSize: "12px",
                      marginBottom: "4px",
                    }}
                  >
                    <span style={{ color: "#111111", fontWeight: 500 }}>{r.label}</span>
                    <span style={{ color: "#444441" }}>
                      {fmtCurrency(r.value)}{" "}
                      <span style={{ color: "#888780", fontSize: "11px" }}>{pct}%</span>
                    </span>
                  </div>
                  <div
                    style={{
                      height: "5px",
                      background: "#f5f4f0",
                      borderRadius: "4px",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        height: "100%",
                        width: pct + "%",
                        background: "#2a78d6",
                      }}
                    />
                  </div>
                </div>
              );
            })}
            <div
              style={{
                marginTop: "8px",
                padding: "8px 12px",
                background: "#f5f4f0",
                borderRadius: "8px",
                display: "flex",
                justifyContent: "space-between",
                fontSize: "12px",
                fontWeight: 600,
                color: "#111111",
              }}
            >
              <span>YTD total</span>
              <span>{fmtCurrency(total)}</span>
            </div>
          </div>
        </Section>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <div
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "10px",
        }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function Stack({ children }: { children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>{children}</div>;
}

function Empty({ label }: { label: string }) {
  return <div style={{ fontSize: "12px", color: "#888780", padding: "4px 0" }}>{label}</div>;
}
