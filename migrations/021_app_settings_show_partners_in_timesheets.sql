-- Whether a Partner shows as a row in the Timesheets "By employee" table.
--
-- Partners are already excluded from the practice-wide utilisation figures
-- (see app/(dashboard)/timesheets/page.tsx -- countsTowardPracticeTotal), but
-- until now they always still appeared as a row in that table showing their
-- own hours. Default true keeps that unchanged for anyone who hasn't touched
-- the new Settings toggle.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS show_partners_in_timesheets boolean NOT NULL DEFAULT true;
