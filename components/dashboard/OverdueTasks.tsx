import type { KarbonTask } from "@/types/karbon";

function formatDue(d: string): string {
  if (!d) return "—";
  return new Date(d + "T00:00:00Z").toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function OverdueTasks({ tasks }: { tasks: KarbonTask[] }) {
  const overdue = tasks.filter((t) => t.isOverdue).slice(0, 8);

  return (
    <div style={{
      background: "white",
      border: "0.5px solid #e1e0d9",
      borderRadius: "14px",
      padding: "1.1rem 1.2rem",
    }}>
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "14px",
      }}>
        <div style={{ fontSize: "13px", fontWeight: "500", color: "#111111" }}>
          Overdue Tasks
        </div>
      </div>
      {overdue.length === 0 ? (
        <div style={{ fontSize: "12px", color: "#888780", padding: "8px 0" }}>Nothing overdue.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {overdue.map((task) => (
            <div key={task.id} style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "10px 12px",
              backgroundColor: "#fafaf8",
              borderRadius: "8px",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#111111",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}>
                  {task.title}
                </div>
                <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>
                  {task.assigneeName || "Unassigned"} • Due {formatDue(task.dueDate)}
                </div>
              </div>
              <div style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#e24b4a",
                marginLeft: "12px",
                flexShrink: 0,
              }} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
