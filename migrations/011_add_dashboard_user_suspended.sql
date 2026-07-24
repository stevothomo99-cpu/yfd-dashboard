-- Lets an admin pause a dashboard user's access without deleting their
-- account (reversible), separate from fully removing them (destructive --
-- see app/api/admin/users/[id]/route.ts's DELETE handler).

ALTER TABLE dashboard_users ADD COLUMN IF NOT EXISTS suspended boolean NOT NULL DEFAULT false;
