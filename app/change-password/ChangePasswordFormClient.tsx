"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";

interface Props {
  forced: boolean;
}

export default function ChangePasswordFormClient({ forced }: Props) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/account/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to change password.");
        return;
      }

      // The JWT session still carries the old mustChangePassword claim (and
      // there's no reason to keep the old session alive after a password
      // change anyway) -- sign out and have them sign back in with the new
      // password, same as any other credentials change.
      setDone(true);
      await signOut({ redirect: false });
      window.location.href = "/login";
    } catch {
      setError("Failed to change password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {forced ? (
        <div
          style={{
            fontSize: "12px",
            color: "#633806",
            background: "#FAEEDA",
            border: "0.5px solid #f0d9a8",
            borderRadius: "8px",
            padding: "8px 10px",
          }}
        >
          Your account was just created with a temporary password. Set your own before continuing.
        </div>
      ) : null}

      <Field label="New password" value={newPassword} onChange={setNewPassword} autoFocus />
      <Field label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />

      {error ? <ErrorBanner>{error}</ErrorBanner> : null}

      <button
        type="submit"
        disabled={busy || done || !newPassword || !confirmPassword}
        style={{
          marginTop: "4px",
          fontSize: "13px",
          fontWeight: 500,
          padding: "11px 22px",
          borderRadius: "8px",
          background: busy || done || !newPassword || !confirmPassword ? "#b4b2a9" : "#2a78d6",
          color: "white",
          border: "none",
          cursor: busy || done || !newPassword || !confirmPassword ? "not-allowed" : "pointer",
        }}
      >
        {done ? "Signing you out…" : busy ? "Saving…" : "Set new password"}
      </button>
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}) {
  return (
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
        {label}
      </span>
      <input
        type="password"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete="new-password"
        autoFocus={autoFocus}
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
  );
}

function ErrorBanner({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: "12px",
        color: "#A32D2D",
        background: "#FCEBEB",
        border: "0.5px solid #f5d6d6",
        padding: "8px 10px",
        borderRadius: "8px",
      }}
    >
      {children}
    </div>
  );
}
