-- Adds task categorisation (Bookkeeping / BAS-IAS / Payroll / Tax /
-- Advisory / Month-end close / General). See 003_workflow_schema.sql for
-- reconciliation context -- this file brings an already-live change into
-- the repo, idempotently.

CREATE TABLE IF NOT EXISTS task_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#888780',
  sort_order integer NOT NULL DEFAULT 0
);

ALTER TABLE task_types ENABLE ROW LEVEL SECURITY;

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type_id uuid REFERENCES task_types(id);

CREATE INDEX IF NOT EXISTS tasks_type_id_idx ON tasks(type_id);

INSERT INTO task_types (name, color, sort_order) VALUES
  ('Bookkeeping', '#2a78d6', 0),
  ('BAS/IAS', '#9b59b6', 1),
  ('Payroll', '#eda100', 2),
  ('Tax', '#1baf7a', 3),
  ('Advisory', '#e24b4a', 4),
  ('Month-end close', '#4ECDC4', 5),
  ('General', '#888780', 6)
ON CONFLICT (name) DO NOTHING;
