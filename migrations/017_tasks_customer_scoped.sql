-- Tasks/workflow belong to the CLIENT, not the JOB.
--
-- Confirmed directly with the practice: time is captured against jobs in
-- XPM, and jobs are billed to clients -- that's the only place jobs are
-- used. Workflow and tasks are recorded against clients. The schema had
-- tasks.job_id NOT NULL, forcing every task through a job purely to reach
-- its client (hydrateTask did job -> job.customer_id -> customer just to
-- find out which client a task belonged to; the job carried no other
-- meaning for a task). That's the same job-vs-client confusion already
-- fixed once on customers.manager_id (migration 014) -- Managers/Partners
-- are a client-level allocation in XPM, not something to infer from a
-- client's jobs.
--
-- tasks table is empty at the time of this migration, so this is a clean
-- structural change, not a data migration.

ALTER TABLE tasks ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id);
ALTER TABLE tasks ALTER COLUMN job_id DROP NOT NULL;

CREATE INDEX IF NOT EXISTS tasks_customer_id_idx ON tasks(customer_id);

-- Safe to enforce NOT NULL immediately since the table is empty; a repo
-- clone against a database that already has task rows would need to
-- backfill customer_id (from job_id -> jobs.customer_id) before this line
-- could run.
ALTER TABLE tasks ALTER COLUMN customer_id SET NOT NULL;

-- No task field carries any job-specific meaning -- confirmed directly:
-- tasks/workflow are recorded against clients, full stop. Keeping job_id
-- nullable-but-unused would just be dead weight, so it's dropped rather
-- than parked.
ALTER TABLE tasks DROP COLUMN IF EXISTS job_id;
DROP INDEX IF EXISTS tasks_job_id_idx;
