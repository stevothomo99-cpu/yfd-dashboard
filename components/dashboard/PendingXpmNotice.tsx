export default function PendingXpmNotice({ title, note }: { title: string; note?: string }) {
  return (
    <div
      style={{
        background: "white",
        border: "0.5px solid #e1e0d9",
        borderRadius: "14px",
        padding: "1.1rem 1.2rem",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        minHeight: "220px",
      }}
    >
      <div style={{ fontSize: "13px", fontWeight: 500, color: "#111111", marginBottom: "8px" }}>
        {title}
      </div>
      <div style={{ fontSize: "12px", color: "#888780", lineHeight: 1.5 }}>
        Pending XPM integration —{" "}
        {note ??
          "needs Xero's Practice Manager API access, which requires a security-assessment approval from Xero before it can be enabled."}
      </div>
    </div>
  );
}
