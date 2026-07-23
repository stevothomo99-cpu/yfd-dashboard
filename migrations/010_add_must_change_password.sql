-- Flags a dashboard_user as needing to set their own password before using
-- the app -- set true whenever an admin creates a user with a password of
-- their own choosing (see app/api/admin/users/route.ts), cleared once the
-- user successfully changes it themselves (forced via /change-password, or
-- via the self-service forgot-password flow).

ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false;
