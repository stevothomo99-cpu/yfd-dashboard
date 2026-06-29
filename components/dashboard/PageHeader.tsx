interface PageHeaderProps {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}

export default function PageHeader({ title, subtitle, action }: PageHeaderProps) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        gap: "16px",
        marginBottom: "8px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "20px", fontWeight: 500, color: "#111111", margin: 0 }}>{title}</h1>
        {subtitle ? (
          <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>{subtitle}</div>
        ) : null}
      </div>
      {action}
    </div>
  );
}
