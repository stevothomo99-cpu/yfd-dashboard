// Shared card/page shell for every unauthenticated-adjacent auth page
// (login, forgot-password, reset-password, change-password) -- extracted
// from what was originally login/page.tsx's inline Shell so the same look
// doesn't get re-typed on every new page in this flow.
export default function AuthShell({
  subtitle,
  children,
}: {
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f4f0",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
      }}
    >
      <div
        style={{
          background: "white",
          border: "0.5px solid #e1e0d9",
          borderRadius: "14px",
          padding: "2.2rem 2.4rem",
          width: "100%",
          maxWidth: "380px",
        }}
      >
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <div style={{ fontSize: "28px", marginBottom: "10px" }}>📊</div>
          <h1 style={{ fontSize: "18px", fontWeight: 500, color: "#111111", margin: 0 }}>
            YFD Dashboard
          </h1>
          <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>{subtitle}</div>
        </div>
        {children}
        <div
          style={{
            fontSize: "11px",
            color: "#888780",
            textAlign: "center",
            marginTop: "20px",
          }}
        >
          Internal use only · Your Financial Direction
        </div>
      </div>
    </div>
  );
}
