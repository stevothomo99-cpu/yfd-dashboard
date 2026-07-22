import type { TaskWithDetails } from "@/types/workflow";

interface Props {
  tasks: TaskWithDetails[];
  today: string;
  emptyLabel: string;
  maxRows?: number;
}

// Compact task list under a dashboard tile -- shows what actually makes up
// a tile's number, not just the count. Caps rows so a large practice-wide
// rollup (Partner view) doesn't turn the dashboard into an endless list;
// the rest are just noted, not hidden silently.
export default function WorkItemMiniTable({ tasks, today, emptyLabel, maxRows = 6 }: Props) {
  if (tasks.length === 0) {
    return <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0 0" }}>{emptyLabel}</div>;
  }

  const visible = tasks.slice(0, maxRows);
  const hiddenCount = tasks.length - visible.length;

  return (
    <div style={{ marginTop: "10px", borderTop: "0.5px solid #e1e0d9", paddingTop: "10px" }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        {visible.map((t) => {
          const overdue = Boolean(t.dueDate && t.dueDate < today);
          return (
            <div key={t.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "8px" }}>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12px",
                    fontWeight: 500,
                    color: "#111111",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {t.title}
                </div>
                <div style={{ fontSize: "11px", color: "#888780" }}>{t.customerName}</div>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: overdue ? "#e24b4a" : "#444441",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                {t.dueDate ?? "No due date"}
              </div>
            </div>
          );
        })}
      </div>
      {hiddenCount > 0 ? (
        <div style={{ fontSize: "11px", color: "#888780", marginTop: "8px" }}>+{hiddenCount} more · see My Work</div>
      ) : null}
    </div>
  );
}
