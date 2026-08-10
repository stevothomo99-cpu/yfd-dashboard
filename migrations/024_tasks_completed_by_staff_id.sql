-- Records who completed a task, alongside the existing completed_at --
-- a small audit note shown on the task modal ("Completed by X on Y"),
-- not a full multi-entry history log. Nulled out again if the task is
-- reopened, same as completed_at, since it describes current state.
alter table tasks add column completed_by_staff_id uuid references staff(id) on delete set null;
