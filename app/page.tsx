import Link from "next/link";

export default function Home() {
  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#f5f4f0"
    }}>
      <div style={{
        background: "white",
        borderRadius: "16px",
        padding: "48px",
        textAlign: "center",
        border: "0.5px solid #e1e0d9",
        maxWidth: "400px",
        width: "100%"
      }}>
        <div style={{ fontSize: "32px", marginBottom: "8px" }}>📊</div>
        <h1 style={{
          fontSize: "22px",
          fontWeight: "500",
          color: "#111111",
          marginBottom: "8px"
        }}>
          YFD Dashboard
        </h1>
        <p style={{
          fontSize: "13px",
          color: "#888780",
          marginBottom: "32px"
        }}>
          Overseas bookkeeping team — operations overview
        </p>
        <Link href="/dashboard" style={{
          display: "inline-block",
          background: "#2a78d6",
          color: "white",
          padding: "10px 28px",
          borderRadius: "8px",
          fontSize: "13px",
          fontWeight: "500",
          textDecoration: "none"
        }}>
          Enter Dashboard →
        </Link>
      </div>
    </div>
  );
}