-- Add TOTP-based MFA support to dashboard_users.
-- mfa_secret holds the per-user TOTP secret, AES-256-GCM encrypted at the
-- application layer (lib/crypto.ts) before being written here -- never
-- stored in plaintext, same pattern as the Xero/XPM OAuth tokens.
ALTER TABLE dashboard_users
  ADD COLUMN IF NOT EXISTS mfa_secret text,
  ADD COLUMN IF NOT EXISTS mfa_enabled boolean NOT NULL DEFAULT false;
