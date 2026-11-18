-- Lets a client be hidden ("moved on") without deleting its history --
-- notes/files/tasks/jobs all stay intact and still resolve, archived
-- clients just drop out of the /clients grid and new-task client pickers by
-- default. An admin-only button (TileDrawer) toggles this directly; the XPM
-- resync (lib/xpmSync.ts) also sets it from the client's own isArchived
-- flag in XPM, so a client archived there gets archived here too instead of
-- being silently deleted the way it used to be.
ALTER TABLE customers ADD COLUMN IF NOT EXISTS archived boolean NOT NULL DEFAULT false;
