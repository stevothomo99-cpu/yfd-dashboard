-- Lightweight "to-do" items created by forwarding an email to a shared
-- inbound address (see app/api/email/inbound/route.ts) -- distinct from the
-- full tasks table, which requires a job_id and carries status/type
-- machinery meant for ongoing recurring work. A to-do starts with just a
-- title/body from the email and no client/due date; the owner populates
-- those themselves. If they mark it recurring at that point it's converted
-- into a real task instead (see lib/todos.ts's populateTodoItem) since
-- recurring work needs the full task machinery a to-do doesn't have.

CREATE TABLE IF NOT EXISTS todo_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  -- Who actually sent/forwarded the email -- may differ from owner_staff_id
  -- when someone delegates a to-do to a colleague (To = colleague, Cc = the
  -- shared inbound address) rather than creating one for themselves
  -- (To = the shared inbound address directly). Plain snapshot, not a FK,
  -- same reasoning as customer_notes.author_name/email.
  created_by_email text,
  created_by_name text,
  subject text NOT NULL,
  body text,
  customer_id uuid REFERENCES customers(id),
  due_date date,
  status text NOT NULL DEFAULT 'pending_triage'
    CHECK (status IN ('pending_triage', 'todo', 'done', 'converted')),
  converted_task_id uuid REFERENCES tasks(id),
  -- Resend's email id for the source message -- lets a webhook retry (same
  -- email delivered twice) be deduped rather than creating a duplicate item.
  source_email_id text UNIQUE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS todo_items_owner_staff_id_idx ON todo_items(owner_staff_id);

ALTER TABLE todo_items ENABLE ROW LEVEL SECURITY;
