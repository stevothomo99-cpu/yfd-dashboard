-- Notes and file attachments on a Client (customers table), requested to
-- support day-to-day client record-keeping directly in the dashboard.
--
-- Author/uploader are stored as plain name+email snapshots rather than a
-- foreign key to staff or dashboard_users -- those are two separate,
-- not-fully-linked identity systems today (see lib/workflow.ts's
-- getStaffByEmail), and a note should keep showing who wrote it even if
-- the underlying account is later renamed or removed.

CREATE TABLE IF NOT EXISTS customer_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  author_email text,
  body text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_notes_customer_id_idx ON customer_notes(customer_id);

ALTER TABLE customer_notes ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS customer_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  storage_path text NOT NULL UNIQUE,
  content_type text,
  size_bytes bigint,
  uploaded_by_name text,
  uploaded_by_email text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS customer_files_customer_id_idx ON customer_files(customer_id);

ALTER TABLE customer_files ENABLE ROW LEVEL SECURITY;

-- Private bucket -- files are only ever read/written via the service-role
-- client server-side (signed URLs generated on demand for download), same
-- access pattern as every other table here (RLS enabled, no policies).
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', false)
ON CONFLICT (id) DO NOTHING;
