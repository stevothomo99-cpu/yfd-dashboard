-- Widens tasks.bas_stage to also accept an explicit 'pending' value (on top
-- of the existing NULL = "Pending" convention from migration 022) so
-- backward transitions -- ready_for_approval/waiting_on_customer -> Pending
-- -- can write a real value instead of overloading NULL for "moved back
-- here" vs "never touched". Existing NULL rows are left alone (no backfill)
-- and keep meaning Pending everywhere the column is read.
ALTER TABLE tasks DROP CONSTRAINT IF EXISTS tasks_bas_stage_check;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_bas_stage_check
    CHECK (bas_stage IN ('pending', 'ready_for_approval', 'waiting_on_customer'));

-- Audit trail for every /bas-status stage transition, in either direction.
-- changed_by_staff_id is nullable: the bas-stage API route already resolves
-- the acting staff member (via getStaffByEmail against the session email,
-- the same lookup canModifyTask's permission check uses) when the caller
-- has a linked staff record, but admins acting without one leave this null
-- rather than inventing new auth plumbing just for this log.
CREATE TABLE IF NOT EXISTS bas_stage_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  from_stage text,
  to_stage text NOT NULL,
  changed_by_staff_id uuid REFERENCES staff(id),
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bas_stage_history_task_id_idx ON bas_stage_history (task_id);
