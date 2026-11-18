-- Lets a note carry one attached file instead of a note and a file always
-- being two separate, unrelated things in the client drawer. Nullable so
-- every existing row (and every file uploaded standalone via the Files
-- section) is unaffected -- note_id null means "a standalone file", set
-- means "this file belongs to that note" and it stops showing up in the
-- plain Files list (see getCustomerFiles/getCustomerNotes in
-- lib/workflow.ts). ON DELETE CASCADE: deleting a note with an attachment
-- takes the file with it, same as customer_files already cascades from
-- customers.
ALTER TABLE customer_files ADD COLUMN IF NOT EXISTS note_id uuid REFERENCES customer_notes(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS customer_files_note_id_idx ON customer_files(note_id);
