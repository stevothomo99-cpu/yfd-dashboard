"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import AuthShell from "@/components/auth/AuthShell";

export default function LoginPage() {
  return (
    <Suspense fallback={<AuthShell subtitle="Sign in to continue" />}>
      <LoginForm />
    </Suspense>
  );
}

function safeCallback(raw: string | null): string {
  if (!raw) return "/";
  // Only accept relative paths starting with a single "/" — reject "//evil"
  // (schemaless URL) and any absolute http(s):// to prevent open redirect.
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return "/";
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = safeCallback(searchParams.get("callbackUrl"));

  const [step, setStep] = useState<"credentials" | "mfa">("credentials");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function finishSignIn(extra?: { totpCode: string }) {
    const result = await signIn("credentials", {
      username,
      password,
      ...(extra ?? {}),
      redirect: false,
    });

    if (!result || result.error) {
      return false;
    }

    router.push(callbackUrl);
    router.refresh();
    return true;
  }

  async function onCredentialsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/auth/mfa-check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body: { valid: boolean; mfaRequired?: boolean } = await res.json();

      if (!body.valid) {
        setError("Username or password is incorrect.");
        return;
      }

      if (body.mfaRequired) {
        setStep("mfa");
        return;
      }

      const ok = await finishSignIn();
      if (!ok) setError("Username or password is incorrect.");
    } catch {
      setError("Username or password is incorrect.");
    } finally {
      setBusy(false);
    }
  }

  async function onMfaSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const ok = await finishSignIn({ totpCode });
      if (!ok) setError("Invalid code.");
    } catch {
      setError("Invalid code.");
    } finally {
      setBusy(false);
    }
  }

  if (step === "mfa") {
    return (
      <AuthShell subtitle="Sign in to continue">
        <form onSubmit={onMfaSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ fontSize: "12px", color: "#888780", marginBottom: "-4px" }}>
            Enter the 6-digit code from your authenticator app.
          </div>
          <Field
            label="Authentication code"
            type="text"
            value={totpCode}
            onChange={setTotpCode}
            autoComplete="one-time-code"
            autoFocus
          />

          {error ? <ErrorBanner>{error}</ErrorBanner> : null}

          <button
            type="submit"
            disabled={busy || !totpCode}
            style={buttonStyle(busy || !totpCode)}
          >
            {busy ? "Verifying…" : "Verify"}
          </button>
        </form>
      </AuthShell>
    );
  }

  return (
    <AuthShell subtitle="Sign in to continue">
      <form
        onSubmit={onCredentialsSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "12px" }}
      >
        <Field
          label="Username"
          type="text"
          value={username}
          onChange={setUsername}
          autoComplete="username"
          autoFocus
        />
        <Field
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
        />

        {error ? <ErrorBanner>{error}</ErrorBanner> : null}

        <button
          type="submit"
          disabled={busy || !username || !password}
          style={buttonStyle(busy || !username || !password)}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <Link
          href="/forgot-password"
          style={{ fontSize: "12px", color: "#888780", textAlign: "center", marginTop: "2px" }}
        >
          Forgot password?
        </Link>
      </form>
    </AuthShell>
  );
}

function buttonStyle(disabled: boolean): React.CSSProperties {
  return {
    marginTop: "4px",
    fontSize: "13px",
    fontWeight: 500,
    padding: "11px 22px",
    borderRadius: "8px",
    background: disabled ? "#b4b2a9" : "#2a78d6",
    color: "white",
    border: "none",
    cursor: disabled ? "not-allowed" : "pointer",
  };
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

function Field({
  label,
  type,
  value,
  onChange,
  autoComplete,
  autoFocus,
}: {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
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
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
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
