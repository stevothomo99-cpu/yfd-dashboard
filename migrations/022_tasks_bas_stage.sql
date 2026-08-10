-- Tracks BAS/IAS tasks through the approval pipeline shown on /bas-status:
-- NULL = "Pending" (the default, unset state -- every BAS/IAS task starts
-- here), 'ready_for_approval' once a staff member ticks their checkbox
-- (which also temporarily reassigns the task to the approving Partner via
-- the existing tasks.temp_assignee_id mechanism -- see lib/workflow.ts),
-- 'waiting_on_customer' once the approver ticks theirs (which clears the
-- temp reassignment). Not restricted to BAS/IAS tasks at the DB level --
-- that's enforced by the API route -- so the column stays a plain, generic
-- workflow stage rather than a BAS-specific type needing its own table.
ALTER TABLE tasks
  ADD COLUMN IF NOT EXISTS bas_stage text
    CHECK (bas_stage IN ('ready_for_approval', 'waiting_on_customer'));
