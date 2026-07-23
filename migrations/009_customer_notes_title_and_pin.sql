-- Adds an optional title and a "pin to top" flag to customer_notes, so a
-- note can be quickly identified in a growing list and important ones kept
-- visible without scrolling.

ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE customer_notes ADD COLUMN IF NOT EXISTS pinned boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS customer_notes_pinned_idx ON customer_notes(customer_id, pinned);
