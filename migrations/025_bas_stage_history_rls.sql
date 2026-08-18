-- migration 023 created bas_stage_history without enabling RLS, unlike
-- every other business table (staff/customers/jobs/statuses/tasks etc. in
-- 003_workflow_schema.sql) -- an oversight, not a deliberate exception.
-- No policies needed here either, matching those tables: the app only ever
-- reads/writes through the service-role key (lib/workflow.ts's
-- getSupabaseAdmin, which bypasses RLS entirely), so RLS-with-no-policies
-- is a deny-all for the anon/authenticated roles the Supabase client
-- libraries use, closing off direct access via the anon key.
ALTER TABLE bas_stage_history ENABLE ROW LEVEL SECURITY;
