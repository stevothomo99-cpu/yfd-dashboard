import { authenticator } from "otplib";

// TOTP-based MFA (authenticator apps: Google Authenticator, Authy, 1Password,
// etc.) for dashboard_users. Secrets are encrypted at rest via
// lib/crypto.ts's encryptSecret/decryptSecret before being written to the
// dashboard_users.mfa_secret column — see lib/supabase.ts for the
// storage-layer functions that handle that.

const ISSUER = "YFD Dashboard";

// Generates a new base32 TOTP secret for enrollment.
export function generateMfaSecret(): string {
  return authenticator.generateSecret();
}

// Builds an otpauth:// URI suitable for rendering as a QR code so an
// authenticator app can scan it to enroll.
export function generateMfaKeyUri(secret: string, accountEmail: string): string {
  return authenticator.keyuri(accountEmail, ISSUER, secret);
}

// Verifies a submitted 6-digit code against the given secret.
export function verifyMfaCode(secret: string, code: string): boolean {
  try {
    return authenticator.check(code, secret);
  } catch (err) {
    console.error("[verifyMfaCode] failed to verify code:", err);
    return false;
  }
}
