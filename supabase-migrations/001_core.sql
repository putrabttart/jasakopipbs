-- ============================================================
-- Core schema: settings and orders
-- Run this migration before every other migration in this folder.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT orders_status_check
    CHECK (status IN ('pending', 'processing', 'ready', 'done', 'cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_orders_created_at
  ON orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status_created_at
  ON orders(status, created_at DESC);

-- Keep updated_at correct for status/data changes made by API routes.
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
BEFORE UPDATE ON orders
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

-- The application accesses Supabase with the service-role key from server-only
-- route handlers. No direct anon/authenticated table access is required.
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE settings FROM anon, authenticated;
REVOKE ALL ON TABLE orders FROM anon, authenticated;

-- Non-secret defaults. QRIS is intentionally not seeded and must be configured
-- from the admin page after the first successful login.
INSERT INTO settings (key, value, updated_at)
VALUES
  ('service_open', '{"open": true, "message": ""}'::jsonb, NOW()),
  ('service_fee', '{"fee": 7000}'::jsonb, NOW()),
  ('delivery_config', '{"enabled": false, "fee": 10000, "outlets": []}'::jsonb, NOW()),
  ('testimonials', '{"items": []}'::jsonb, NOW())
ON CONFLICT (key) DO NOTHING;
