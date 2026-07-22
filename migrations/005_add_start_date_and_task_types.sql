-- Adds a task start_date (distinct from due_date -- lets a recurring task's
-- next instance be scheduled ahead of when it's actually due). See
-- 003_workflow_schema.sql for reconciliation context.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS start_date date;
