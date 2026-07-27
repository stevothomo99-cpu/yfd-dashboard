-- A to-do's display name, when the owner has renamed it.
--
-- Deliberately a new column rather than making `subject` editable: subject
-- is the forwarded email's actual Subject header, and it stays the record
-- of where the item came from (alongside created_by_email/body). Renaming
-- overrides how the item is *displayed* without rewriting that history, so
-- an item can still be traced back to the message that created it.
--
-- Null means "never renamed" -- the UI falls back to subject, so existing
-- rows need no backfill.

ALTER TABLE todo_items ADD COLUMN IF NOT EXISTS title text;
