-- Karbon Import matches each WorkItem's client name against this app's
-- customers by name, and that match is sometimes wrong (near-duplicate
-- names, a client renamed on one side but not the other). Once a task is
-- imported there was previously no way to tell what Karbon actually called
-- the client, so a wrong match looked identical to a right one. Stamped at
-- import time only -- null for every task created any other way.
ALTER TABLE tasks ADD COLUMN karbon_client_name text;
