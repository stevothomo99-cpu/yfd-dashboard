-- Last successful login per dashboard user, for the User Management table.
--
-- Nullable with no default on purpose: NULL means "has never logged in",
-- which is a distinct and useful state on this screen -- an account created
-- weeks ago that has never been used is either a person who needs chasing or
-- one who never needed the access. Defaulting it to now() at creation time
-- would erase exactly that signal.
--
-- Written only after a login fully succeeds, MFA step included (see the
-- authorize() callback in auth.ts), so it means "got in", not "tried".

ALTER TABLE dashboard_users
  ADD COLUMN IF NOT EXISTS last_login_at timestamp with time zone;
