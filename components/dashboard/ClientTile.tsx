import StaffAvatar from "./StaffAvatar";
import { initialsOf } from "@/lib/utils";
import type { ClientSummary } from "@/types/workflow";

export type TileStatus = "overdue" | "in-progress" | "all-clear";

export function statusOf(tile: ClientSummary): TileStatus {
  if (tile.overdueCount > 0) return "overdue";
  if (tile.inProgressCount > 0) return "in-progress";
  return "all-clear";
}

const TOP_BORDER: Record<TileStatus, string> = {
  overdue: "#e24b4a",
  "in-progress": "#eda100",
  "all-clear": "#1baf7a",
};

interface Props {
  tile: ClientSummary;
  hoursLogged?: number;
  hoursPeriodLabel?: string;
  onClick?: () => void;
}

function fmtDate(d: string): string {
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function ClientTile({ tile, hoursLogged, hoursPeriodLabel, onClick }: Props) {
  const status = statusOf(tile);

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
      <div>
        <div style={{ fontSize: "14px", fontWeight: 600, color: "#111111" }}>{tile.name}</div>
        {tile.managerName ? (
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <StaffAvatar initials={initialsOf(tile.managerName)} size={20} />
            <span style={{ fontSize: "11px", color: "#888780" }}>{tile.managerName}</span>
          </div>
        ) : (
          <div style={{ fontSize: "11px", color: "#888780", marginTop: "4px" }}>No manager assigned</div>
        )}
      </div>

      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <TaskBadge count={tile.overdueCount} label="overdue" color="#e24b4a" />
        <TaskBadge count={tile.inProgressCount} label="in progress" color="#eda100" />
        <TaskBadge count={tile.completedCount} label="done" color="#1baf7a" />
        {tile.overdueBasCount > 0 ? (
          <TaskBadge count={tile.overdueBasCount} label="overdue BAS" color="#9b1c1c" />
        ) : null}
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        {tile.nextDueDate ? (
          <div style={{ fontSize: "11px", color: "#888780" }}>
            Next due <span style={{ color: "#444441", fontWeight: 500 }}>{fmtDate(tile.nextDueDate)}</span>
          </div>
        ) : (
          <span />
        )}
        {hoursLogged !== undefined ? (
          <div style={{ fontSize: "11px", color: "#888780" }}>
            <span style={{ color: "#444441", fontWeight: 500 }}>{hoursLogged.toFixed(1)}</span> hrs
            {hoursPeriodLabel ? ` (${hoursPeriodLabel})` : ""}
          </div>
        ) : null}
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
