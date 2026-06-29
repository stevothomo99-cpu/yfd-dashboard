import StaffAvatar from "./StaffAvatar";
import BasStatusBadge from "./BasStatusBadge";
import { fmtCompact, initialsOf } from "@/lib/utils";
import type { ClientTile as ClientTileType } from "@/types/dashboard";

export type TileStatus = "overdue" | "in-progress" | "all-clear";

export function statusOf(tile: ClientTileType): TileStatus {
  if (tile.overdueTasks.length > 0) return "overdue";
  if (tile.inProgressTasks.length > 0) return "in-progress";
  return "all-clear";
}

const TOP_BORDER: Record<TileStatus, string> = {
  overdue: "#e24b4a",
  "in-progress": "#eda100",
  "all-clear": "#1baf7a",
};

interface Props {
  tile: ClientTileType;
  onClick?: () => void;
}

export default function ClientTile({ tile, onClick }: Props) {
  const status = statusOf(tile);
  const pct = Math.min(Math.round((tile.ytdInvoiced / tile.ytdTarget) * 100), 100);
  const pctColor = pct >= 100 ? "#1baf7a" : pct >= 75 ? "#eda100" : "#e24b4a";

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderTop: "3px solid " + TOP_BORDER[status],
        borderRadius: "14px",
        padding: "1rem 1.1rem",
        textAlign: "left",
        cursor: "pointer",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#111111" }}>{tile.name}</div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginTop: "4px",
            }}
          >
            <StaffAvatar initials={initialsOf(tile.managerName)} size={20} />
            <span style={{ fontSize: "11px", color: "#888780" }}>{tile.managerName}</span>
          </div>
        </div>
        <BasStatusBadge status={tile.basStatus} />
      </div>

      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            marginBottom: "5px",
          }}
        >
          <span style={{ fontSize: "12px", color: "#888780" }}>YTD invoiced</span>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#111111" }}>
            {fmtCompact(tile.ytdInvoiced)}{" "}
            <span style={{ fontSize: "11px", color: pctColor, fontWeight: 500 }}>{pct}%</span>
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
          <div style={{ height: "100%", width: pct + "%", background: pctColor }} />
        </div>
        <div style={{ fontSize: "10px", color: "#888780", marginTop: "4px" }}>
          Target {fmtCompact(tile.ytdTarget)}
        </div>
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <TaskBadge count={tile.overdueTasks.length} label="overdue" color="#e24b4a" />
        <TaskBadge count={tile.inProgressTasks.length} label="in progress" color="#eda100" />
        <TaskBadge count={tile.completedTasks.length} label="done" color="#1baf7a" />
      </div>
    </button>
  );
}

function TaskBadge({ count, label, color }: { count: number; label: string; color: string }) {
  if (count === 0) {
    return (
      <span
        style={{
          fontSize: "10px",
          color: "#888780",
          padding: "3px 8px",
          background: "#f5f4f0",
          borderRadius: "8px",
          fontWeight: 500,
        }}
      >
        0 {label}
      </span>
    );
  }
  return (
    <span
      style={{
        fontSize: "10px",
        color: "white",
        background: color,
        padding: "3px 8px",
        borderRadius: "8px",
        fontWeight: 600,
      }}
    >
      {count} {label}
    </span>
  );
}
