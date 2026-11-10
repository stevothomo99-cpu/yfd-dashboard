-- The original SELECT policy (migration 001) let ANY authenticated Supabase
-- session read every row of dashboard_users -- not just the row-owner.
-- Normally moot, since the app itself only ever reads this table via the
-- service-role client -- except app/reset-password/page.tsx deliberately
-- creates a real, persisted anon-key Supabase Auth session in the browser
-- during password reset. That session could otherwise be used to query the
-- Supabase REST API directly and list every staff member's email,
-- username, role (who's admin), suspended state, and encrypted MFA secret,
-- bypassing this app's own authorization entirely.
--
-- Narrowed to self-only; the existing "Allow admins to manage
-- dashboard_users" FOR ALL policy (migration 001) already covers admin
-- access to every row, so admins lose nothing here.
DROP POLICY IF EXISTS "Allow authenticated users to view dashboard_users" ON dashboard_users;

CREATE POLICY "Allow users to view their own dashboard_users row"
  ON dashboard_users
  FOR SELECT
  USING (auth.uid() = id);
