interface KpiCardProps {
  label: string;
  value: string;
  sub?: string;
  valueColor?: string;
}

export default function KpiCard({ label, value, sub, valueColor }: KpiCardProps) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
      }}
    >
      <div
        style={{
          fontSize: "10px",
          fontWeight: 500,
          color: "#888780",
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          marginBottom: "8px",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "26px",
          fontWeight: 500,
          color: valueColor || "#111111",
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {sub ? (
        <div style={{ fontSize: "12px", color: "#888780", marginTop: "6px" }}>{sub}</div>
      ) : null}
    </div>
  );
}
