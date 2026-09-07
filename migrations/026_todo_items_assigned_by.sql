-- Tracks who last assigned/reassigned a to-do to its current owner via the
-- dashboard's "Assign to" picker -- distinct from created_by_email/name,
-- which is the original forwarder of the email. Null until someone actually
-- uses the picker; to-dos resolved purely by the inbound email's To/Cc
-- routing never get a value here.
alter table todo_items
  add column assigned_by_staff_id uuid references staff(id) on delete set null;
