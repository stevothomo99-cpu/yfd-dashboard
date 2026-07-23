-- Reusable "task templates": a named, saved shape of tasks (title + type +
-- recurrence only) that can be applied to any job to bulk-create fresh
-- tasks from it. Lets a Partner/Manager save a client's standard task list
-- once and roll it out to a new client instead of re-typing every task.
--
-- Deliberately does NOT store due_date/start_date/assignee_id/status_id/
-- completed_at -- those are specific to one client's actual schedule and
-- staffing, not part of the reusable "shape" (see lib/workflow.ts's
-- saveTasksAsTemplate/applyTemplateToJob).

CREATE TABLE IF NOT EXISTS task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS task_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES task_templates(id) ON DELETE CASCADE,
  title text NOT NULL,
  type_id uuid REFERENCES task_types(id),
  recurrence text NOT NULL DEFAULT 'none'
    CHECK (recurrence IN ('none', 'daily', 'weekly', 'fortnightly', 'monthly', 'quarterly')),
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS task_template_items_template_id_idx ON task_template_items(template_id);

-- RLS enabled with no policies -- same access pattern as every other table
-- here (service-role client only, see lib/supabase.ts's getSupabaseAdmin()).
ALTER TABLE task_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_template_items ENABLE ROW LEVEL SECURITY;
