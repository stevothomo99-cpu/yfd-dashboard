-- deleteTaskSeries (lib/workflow.ts) deletes a series' non-completed
-- members, including the root, while leaving completed occurrences in
-- place. That only works if completed children survive the root's
-- deletion with recurrence_parent_id nulled out rather than the delete
-- being rejected outright.
ALTER TABLE tasks DROP CONSTRAINT tasks_recurrence_parent_id_fkey;
ALTER TABLE tasks
  ADD CONSTRAINT tasks_recurrence_parent_id_fkey
  FOREIGN KEY (recurrence_parent_id) REFERENCES tasks(id) ON DELETE SET NULL;
