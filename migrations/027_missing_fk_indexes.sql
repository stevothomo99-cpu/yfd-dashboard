-- Covering indexes for foreign keys flagged by Supabase's performance
-- advisor (unindexed_foreign_keys lint) -- all 11 are join/filter columns
-- hit by lib/workflow.ts on nearly every dashboard page load (tasks.status_id,
-- jobs.partner_id/manager_id, customers.partner_id in particular). Purely
-- additive, no behavior change.

create index if not exists idx_bas_stage_history_changed_by_staff_id
  on bas_stage_history (changed_by_staff_id);

create index if not exists idx_customers_partner_id
  on customers (partner_id);

create index if not exists idx_jobs_manager_id
  on jobs (manager_id);

create index if not exists idx_jobs_partner_id
  on jobs (partner_id);

create index if not exists idx_task_template_items_type_id
  on task_template_items (type_id);

create index if not exists idx_tasks_completed_by_staff_id
  on tasks (completed_by_staff_id);

create index if not exists idx_tasks_recurrence_parent_id
  on tasks (recurrence_parent_id);

create index if not exists idx_tasks_status_id
  on tasks (status_id);

create index if not exists idx_todo_items_assigned_by_staff_id
  on todo_items (assigned_by_staff_id);

create index if not exists idx_todo_items_converted_task_id
  on todo_items (converted_task_id);

create index if not exists idx_todo_items_customer_id
  on todo_items (customer_id);
