"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import AuthShell from "@/components/auth/AuthShell";

// A dedicated browser client, NOT lib/supabase.ts's shared one -- that one
// sets persistSession: false since it's used server-side, which would also
// disable the session-detection this page depends on. Supabase's recovery
// link lands here carrying either a #access_token=... hash (implicit flow)
// or a ?code=... query param (PKCE flow) depending on project config; this
// client is created fresh so its default detectSessionInUrl behavior can
// pick up whichever one Supabase actually sends.
function getResetClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL as string,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string,
  );
}

type Status = "checking" | "ready" | "invalid" | "done";

export default function ResetPasswordPage() {
  const router = useRouter();
  const [client] = useState(getResetClient);
  const [status, setStatus] = useState<Status>("checking");
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function establishSession() {
      // PKCE flow: a ?code= param needs exchanging for a session explicitly.
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error: exchangeError } = await client.auth.exchangeCodeForSession(code);
        if (exchangeError) {
          if (!cancelled) setStatus("invalid");
          return;
        }
      }

      // Implicit flow (#access_token=...&type=recovery) is auto-detected by
      // the client itself -- either way, a session should exist by now.
      const { data } = await client.auth.getSession();
      if (cancelled) return;
      if (data.session) {
        setAccessToken(data.session.access_token);
        setStatus("ready");
      } else {
        setStatus("invalid");
      }
    }

    establishSession();

    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" && session) {
        setAccessToken(session.access_token);
        setStatus("ready");
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [client]);

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
      const { error: updateError } = await client.auth.updateUser({ password: newPassword });
      if (updateError) {
        setError(updateError.message);
        return;
      }

      if (accessToken) {
        await fetch("/api/auth/reset-password-complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ accessToken }),
        });
      }

      setStatus("done");
      setTimeout(() => router.push("/login"), 2000);
    } catch {
      setError("Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  if (status === "checking") {
    return (
      <AuthShell subtitle="Reset your password">
        <div style={{ fontSize: "13px", color: "#888780" }}>Checking your reset link…</div>
      </AuthShell>
    );
  }

  if (status === "invalid") {
    return (
      <AuthShell subtitle="Reset your password">
        <div style={{ fontSize: "13px", color: "#444441", lineHeight: 1.5 }}>
          This reset link is invalid or has expired. Request a new one from the{" "}
          <a href="/forgot-password" style={{ color: "#2a78d6" }}>
            forgot password
          </a>{" "}
          page.
        </div>
      </AuthShell>
    );
  }

  if (status === "done") {
    return (
      <AuthShell subtitle="Reset your password">
        <div style={{ fontSize: "13px", color: "#444441" }}>
          Password updated. Redirecting you to sign in…
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Set a new password">
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <Field label="New password" value={newPassword} onChange={setNewPassword} autoFocus />
        <Field label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} />

        {error ? (
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
            {error}
          </div>
        ) : null}

        <button
          type="submit"
          disabled={busy || !newPassword || !confirmPassword}
          style={{
            marginTop: "4px",
            fontSize: "13px",
            fontWeight: 500,
            padding: "11px 22px",
            borderRadius: "8px",
            background: busy || !newPassword || !confirmPassword ? "#b4b2a9" : "#2a78d6",
            color: "white",
            border: "none",
            cursor: busy || !newPassword || !confirmPassword ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Saving…" : "Set new password"}
        </button>
      </form>
    </AuthShell>
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
