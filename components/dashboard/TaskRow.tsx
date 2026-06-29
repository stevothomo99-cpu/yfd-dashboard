import type { KarbonTask } from "@/types/karbon";

interface TaskRowProps {
  task: KarbonTask;
  showAssignee?: boolean;
  showClient?: boolean;
  accent?: "overdue" | "today" | "week" | "done";
}

const dotColor: Record<string, string> = {
  overdue: "#e24b4a",
  today: "#eda100",
  week: "#2a78d6",
  done: "#1baf7a",
};

function formatDue(d: string) {
  const date = new Date(d + "T00:00:00Z");
  return date.toLocaleDateString("en-AU", { day: "numeric", month: "short" });
}

export default function TaskRow({ task, showAssignee = true, showClient = true, accent = "week" }: TaskRowProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "10px 12px",
        background: "#fafaf8",
        borderRadius: "8px",
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 500,
            color: "#111111",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {task.title}
        </div>
        <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>
          {showClient ? task.clientName : null}
          {showClient && showAssignee ? " · " : null}
          {showAssignee ? task.assigneeName : null}
          {(showClient || showAssignee) ? " · " : null}
          Due {formatDue(task.dueDate)}
        </div>
      </div>
      <div
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: dotColor[accent],
          marginLeft: "12px",
          flexShrink: 0,
        }}
      />
    </div>
  );
}
