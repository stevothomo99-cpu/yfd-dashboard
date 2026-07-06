import type { WorkflowStatus } from "@/types/workflow";

interface StatusPillProps {
  status: WorkflowStatus;
  statuses: WorkflowStatus[];
  onChange: (statusId: string) => void;
}

export default function StatusPill({ status, statuses, onChange }: StatusPillProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "2px 4px 2px 8px",
        borderRadius: "999px",
        background: "white",
        border: `0.5px solid ${status.color}55`,
        flexShrink: 0,
      }}
    >
      <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: status.color, flexShrink: 0 }} />
      <select
        value={status.id}
        onChange={(e) => onChange(e.target.value)}
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "#444441",
          border: "none",
          background: "transparent",
          padding: "4px 4px",
          cursor: "pointer",
        }}
      >
        {statuses.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}
