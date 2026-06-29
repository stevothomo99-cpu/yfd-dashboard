const tasks = [
  { name: "Creditor reconciliation", owner: "Ana C", due: "Fri last", urgency: "high" },
  { name: "Fixed asset schedule", owner: "Ana C", due: "Wed last", urgency: "high" },
  { name: "Monthly report draft", owner: "Ben T", due: "Tue last", urgency: "high" },
  { name: "Supplier queries", owner: "Ben T", due: "Mon last", urgency: "med" },
  { name: "BAS lodgement — Taylor", owner: "Jay R", due: "Mon", urgency: "high" },
  { name: "Chart of accounts setup", owner: "Lia G", due: "Wed last", urgency: "med" },
  { name: "Receipt scanning backlog", owner: "Lia G", due: "Mon last", urgency: "low" },
];

const urgencyColor: Record<string, string> = {
  high: "#e24b4a",
  med: "#eda100",
  low: "#888780",
};

export default function OverdueTasks() {
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
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {tasks.map((task, index) => (
          <div key={index} style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "10px 12px",
            backgroundColor: "#fafaf8",
            borderRadius: "8px",
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: "13px", fontWeight: "500", color: "#111111" }}>
                {task.name}
              </div>
              <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>
                {task.owner} • Due {task.due}
              </div>
            </div>
            <div style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: urgencyColor[task.urgency],
              marginLeft: "12px",
            }} />
          </div>
        ))}
      </div>
    </div>
  );
}