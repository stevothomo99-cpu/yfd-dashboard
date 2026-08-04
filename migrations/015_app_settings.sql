-- Durable home for the dashboard's own settings, chiefly the XPM Partner
-- filter.
--
-- These previously lived only in Redis, with no TTL and nothing behind them.
-- That works until the cache doesn't: an eviction, a flush, or swapping the
-- Upstash instance silently blanks partnerName, and every XPM-backed tile
-- then degrades to "Set a Partner name in Settings" -- indistinguishable from
-- a genuine first run, with no clue that a setting was lost rather than never
-- set. The Partner filter also scopes which clients, jobs and staff the whole
-- app can see, so losing it empties the practice.
--
-- Redis stays in front of this as a cache; Postgres is now the source of
-- truth. Single row, id fixed at 1 -- there is one settings record, not a
-- collection.

CREATE TABLE IF NOT EXISTS app_settings (
  id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  partner_name text NOT NULL DEFAULT '',
  excluded_staff_ids text[] NOT NULL DEFAULT '{}',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
