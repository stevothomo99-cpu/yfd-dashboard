interface KpiStripProps {
  tasksOverdue: number;
  basLodged: number;
  basTotal: number;
}

const deltaColors: Record<string, string> = {
  up: "#1baf7a",
  down: "#e24b4a",
  warn: "#eda100",
  muted: "#888780",
};

export default function KpiStrip({ tasksOverdue, basLodged, basTotal }: KpiStripProps) {
  const basPending = basTotal - basLodged;
  const kpis = [
    {
      label: "Billable hrs today",
      value: "—",
      delta: "Pending XPM",
      deltaType: "muted",
    },
    {
      label: "Tasks overdue",
      value: String(tasksOverdue),
      delta: tasksOverdue > 0 ? "⚠ needs attention" : "All clear",
      deltaType: tasksOverdue > 0 ? "down" : "up",
      valueColor: tasksOverdue > 0 ? "#e24b4a" : undefined,
    },
    {
      label: "BAS lodged",
      value: `${basLodged}/${basTotal}`,
      delta: basPending > 0 ? `${basPending} pending` : "All lodged",
      deltaType: "muted",
    },
    {
      label: "Team utilisation",
      value: "—",
      delta: "Pending XPM",
      deltaType: "muted",
    },
  ];

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "repeat(4, 1fr)",
      marginBottom: "1.5rem",
      paddingBottom: "1.25rem",
      borderBottom: "1px solid #e1e0d9",
    }}>
      {kpis.map((kpi, i) => (
        <div key={i} style={{
          padding: "0 1.5rem",
          borderLeft: i === 0 ? "none" : "0.5px solid #e1e0d9",
          paddingLeft: i === 0 ? "0" : "1.5rem",
        }}>
          <div style={{
            fontSize: "10px",
            fontWeight: "500",
            color: "#888780",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "6px",
          }}>
            {kpi.label}
          </div>
          <div style={{
            fontSize: "32px",
            fontWeight: "500",
            color: kpi.valueColor || "#111111",
            lineHeight: "1",
            marginBottom: "5px",
          }}>
            {kpi.value}
          </div>
          <div style={{
            fontSize: "12px",
            color: deltaColors[kpi.deltaType],
          }}>
            {kpi.delta}
          </div>
        </div>
      ))}
    </div>
  );
}
