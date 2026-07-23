"use client";

import { useState } from "react";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
    } finally {
      setBusy(false);
      // Always show the same "sent" state regardless of outcome -- the API
      // itself never reveals whether the email matched an account.
      setDone(true);
    }
  }

  return (
    <AuthShell subtitle="Reset your password">
      {done ? (
        <div style={{ fontSize: "13px", color: "#444441", lineHeight: 1.5 }}>
          If <strong>{email.trim()}</strong> is a registered account, a password reset link has been
          sent. Check your inbox (and spam folder) — the link expires after a while, so use it soon.
        </div>
      ) : (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <span
              style={{
                fontSize: "11px",
                fontWeight: 500,
                color: "#444441",
                textTransform: "uppercase",
                letterSpacing: "0.06em",
              }}
            >
              Email
            </span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              style={{
                fontSize: "13px",
                padding: "10px 12px",
                borderRadius: "8px",
                border: "0.5px solid #e1e0d9",
                background: "white",
                color: "#111111",
                outline: "none",
              }}
            />
          </label>

          <button
            type="submit"
            disabled={busy || !email.trim()}
            style={{
              marginTop: "4px",
              fontSize: "13px",
              fontWeight: 500,
              padding: "11px 22px",
              borderRadius: "8px",
              background: busy || !email.trim() ? "#b4b2a9" : "#2a78d6",
              color: "white",
              border: "none",
              cursor: busy || !email.trim() ? "not-allowed" : "pointer",
            }}
          >
            {busy ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}

      <div style={{ textAlign: "center", marginTop: "16px" }}>
        <Link href="/login" style={{ fontSize: "12px", color: "#888780" }}>
          Back to sign in
        </Link>
      </div>
    </AuthShell>
  );
}
