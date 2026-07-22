-- Workflow schema: internal replacement for Karbon's task/work-item system,
-- built on top of XPM's Partner/Client/Job hierarchy.
--
-- Reconciliation note: this schema was originally applied directly to the
-- yfd-workflow Supabase project (xbjxrvqydcbwldnrexqu) in an earlier session
-- via the Supabase MCP tools, without a matching file being committed here.
-- This file (and 004/005) bring the repo's migrations/ folder back in sync
-- with what's actually live. All statements are idempotent so re-running
-- them against the already-migrated database is a safe no-op.
--
-- staff/customers/jobs mirror XPM's Partner -> Client -> Job hierarchy
-- (xpm_*_id columns join back to the live XPM records fetched via
-- lib/xpm.ts). tasks are dashboard-native work items -- due dates,
-- recurrence, and categorisation are managed here, not in XPM or Karbon.

CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xpm_staff_id text UNIQUE,
  name text NOT NULL,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('Partner', 'Manager', 'Staff')),
  included boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  xpm_client_id text UNIQUE,
  name text NOT NULL,
  partner_id uuid REFERENCES staff(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid NOT NULL REFERENCES customers(id),
  xpm_job_id text UNIQUE,
  name text NOT NULL,
  partner_id uuid REFERENCES staff(id),
  manager_id uuid REFERENCES staff(id),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#888780',
  sort_order integer NOT NULL DEFAULT 0,
  is_complete boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES jobs(id),
  title text NOT NULL,
  assignee_id uuid REFERENCES staff(id),
  due_date date,
  status_id uuid NOT NULL REFERENCES statuses(id),
  recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly')),
  recurrence_parent_id uuid REFERENCES tasks(id),
  completed_at timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS jobs_customer_id_idx ON jobs(customer_id);
CREATE INDEX IF NOT EXISTS tasks_job_id_idx ON tasks(job_id);
CREATE INDEX IF NOT EXISTS tasks_assignee_id_idx ON tasks(assignee_id);
CREATE INDEX IF NOT EXISTS tasks_due_date_idx ON tasks(due_date);

-- RLS enabled with no policies -- these tables are only ever read/written
-- server-side via the service-role client (lib/supabase.ts's
-- getSupabaseAdmin()), same pattern as dashboard_users.
ALTER TABLE staff ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

INSERT INTO statuses (name, color, sort_order, is_complete) VALUES
  ('Open', '#b4b2a9', 0, false),
  ('In Progress', '#2a78d6', 1, false),
  ('Waiting on Client', '#eda100', 2, false),
  ('With Steve', '#9b59b6', 3, false),
  ('Completed', '#1baf7a', 4, true)
ON CONFLICT (name) DO NOTHING;
