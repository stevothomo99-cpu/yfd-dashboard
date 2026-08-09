-- Free-text notes/description field on the task itself, editable from the
-- task create/edit modal (see components/dashboard/NewTaskModal.tsx). Kept
-- separate from title -- title is the short label shown everywhere in list
-- views, details is longer-form context that only needs to surface when
-- someone opens the task. Nullable: most tasks (and every task created
-- before this migration) have none.
ALTER TABLE tasks ADD COLUMN details text;
