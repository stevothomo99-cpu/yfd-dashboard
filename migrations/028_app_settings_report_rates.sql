-- Firm-wide $/hr assumptions for the Reports section (starting with Revenue
-- by Client): charge_rate_per_hour values a client's invoiced revenue back
-- into an implied "hours budgeted" figure (there's no real budget stored
-- anywhere -- see that report's comment), and cost_rate_per_hour is what an
-- hour of staff time is assumed to cost the business, used for the
-- Average Monthly Cost / Average hour cost figures. Both are single
-- blended firm-wide numbers, not per-staff -- admin-editable from the
-- report itself, defaults chosen when this was built.

ALTER TABLE app_settings
  ADD COLUMN IF NOT EXISTS charge_rate_per_hour numeric NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS cost_rate_per_hour numeric NOT NULL DEFAULT 35;
