"use client";

import { signIn } from "next-auth/react";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={<Shell />}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const result = await signIn("credentials", {
      username,
      password,
      redirect: false,
    });

    setBusy(false);

    if (!result || result.error) {
      setError("Username or password is incorrect.");
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <Shell>
      <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
          disabled={busy || !username || !password}
          style={{
            marginTop: "4px",
            fontSize: "13px",
            fontWeight: 500,
            padding: "11px 22px",
            borderRadius: "8px",
            background: busy || !username || !password ? "#b4b2a9" : "#2a78d6",
            color: "white",
            border: "none",
            cursor: busy || !username || !password ? "not-allowed" : "pointer",
          }}
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </Shell>
  );
}

function Shell({ children }: { children?: React.ReactNode }) {
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
          <div style={{ fontSize: "12px", color: "#888780", marginTop: "4px" }}>
            Sign in to continue
          </div>
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
