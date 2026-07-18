"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import PageHeader from "@/components/dashboard/PageHeader";

interface SetupResponse {
  secret: string;
  otpauthUrl: string;
}

export default function SecuritySettingsPage() {
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [setup, setSetup] = useState<SetupResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/mfa/status");
      const data = await res.json();
      if (typeof data.mfaEnabled === "boolean") {
        setMfaEnabled(data.mfaEnabled);
      }
    } catch (err) {
      console.error("Failed to fetch MFA status:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  async function handleStartEnroll() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/mfa/setup", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to start enrollment." });
        return;
      }
      setSetup(data);
      setEnrolling(true);

      const QRCode = (await import("qrcode")).default;
      const dataUrl = await QRCode.toDataURL(data.otpauthUrl);
      setQrDataUrl(dataUrl);
    } catch (err) {
      setMessage({ type: "error", text: "Failed to start enrollment." });
    } finally {
      setBusy(false);
    }
  }

  async function handleConfirm(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/mfa/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Invalid code." });
        return;
      }
      setMfaEnabled(true);
      setEnrolling(false);
      setSetup(null);
      setQrDataUrl(null);
      setCode("");
      setMessage({ type: "success", text: "Two-factor authentication is now enabled." });
    } catch (err) {
      setMessage({ type: "error", text: "Invalid code." });
    } finally {
      setBusy(false);
    }
  }

  async function handleDisable() {
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth/mfa/disable", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "error", text: data.error || "Failed to disable MFA." });
        return;
      }
      setMfaEnabled(false);
      setMessage({ type: "success", text: "Two-factor authentication has been disabled." });
    } catch (err) {
      setMessage({ type: "error", text: "Failed to disable MFA." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="My Security"
        subtitle="Manage two-factor authentication for your own account"
      />

      <div className="mb-6 flex gap-4">
        <Link href="/settings">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            Staff & Sync
          </button>
        </Link>
        <Link href="/settings/users">
          <button className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg font-medium hover:bg-blue-100">
            Dashboard Users
          </button>
        </Link>
        <button className="px-4 py-2 bg-gray-100 text-gray-900 rounded-lg font-medium">
          My Security
        </button>
      </div>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success"
              ? "bg-green-50 text-green-800 border border-green-200"
              : "bg-red-50 text-red-800 border border-red-200"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg border p-6">
        <h3 className="text-lg font-semibold mb-2">Two-factor authentication</h3>
        <p className="text-sm text-gray-500 mb-4">
          Protect your account with codes from an authenticator app (Google Authenticator, Authy,
          1Password, etc.) in addition to your password.
        </p>

        {loading ? (
          <div className="text-sm text-gray-500">Loading…</div>
        ) : mfaEnabled ? (
          <div>
            <div className="mb-4">
              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                Two-factor authentication is enabled
              </span>
            </div>
            <button
              onClick={handleDisable}
              disabled={busy}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
            >
              {busy ? "Disabling…" : "Disable"}
            </button>
          </div>
        ) : enrolling && setup ? (
          <div>
            <p className="text-sm text-gray-700 mb-3">
              Scan this QR code with your authenticator app, then enter the 6-digit code it shows to
              confirm setup.
            </p>
            {qrDataUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={qrDataUrl} alt="MFA enrollment QR code" className="mb-3" width={200} height={200} />
            ) : null}
            <div className="text-xs text-gray-500 mb-4">
              Can&apos;t scan? Enter this key manually:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">{setup.secret}</code>
            </div>
            <form onSubmit={handleConfirm} className="space-y-4 max-w-xs">
              <div>
                <label className="block text-sm font-medium mb-2">6-digit code</label>
                <input
                  type="text"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="123456"
                />
              </div>
              <button
                type="submit"
                disabled={busy || !code}
                className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {busy ? "Confirming…" : "Confirm"}
              </button>
            </form>
          </div>
        ) : (
          <button
            onClick={handleStartEnroll}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? "Starting…" : "Enable Two-Factor Authentication"}
          </button>
        )}
      </div>
    </div>
  );
}
