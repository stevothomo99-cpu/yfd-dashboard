-- A client's own Manager, as set on the client record in XPM (its
-- `jobManager` field -- what this app calls the "Staff" role; see
-- lib/xpm.ts's fetchXpmClientsWithManagerForPartner).
--
-- This was already being fetched by the sync but only used as a fallback
-- for jobs whose own manager field was empty -- it was never stored against
-- the client itself. As a result /clients derived a client's manager by
-- aggregating the managers of its *jobs*, which is a different question:
-- a client with a bookkeeper on its BAS jobs and an advisor on its CFO job
-- rendered as "Multiple", and stale legacy jobs kept dragging in managers
-- who no longer look after the client at all.
--
-- Partner is already stored at the client level (partner_id), so this makes
-- the pair symmetrical: both of a client's XPM allocations live on the
-- client row.
--
-- Nullable: a client can have no jobManager set in XPM, the same way it can
-- have no accountManager.

ALTER TABLE customers ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES staff(id);

CREATE INDEX IF NOT EXISTS customers_manager_id_idx ON customers(manager_id);
