-- Supports temporary reassignment: a task can be worked by someone other
-- than its permanent owner (tasks.assignee_id) without leaving the owner's
-- board. temp_assignee_id is the current temporary holder, if any; the
-- effective assignee for "whose board is this on right now" is
-- COALESCE(temp_assignee_id, assignee_id). temp_assigned_at records when the
-- handoff happened, for display/audit -- there is no auto-expiry, reassign
-- back to the owner by clearing temp_assignee_id.

ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS temp_assignee_id uuid REFERENCES staff(id),
  ADD COLUMN IF NOT EXISTS temp_assigned_at timestamp with time zone;

CREATE INDEX IF NOT EXISTS tasks_temp_assignee_id_idx ON tasks(temp_assignee_id);
