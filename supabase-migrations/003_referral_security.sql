-- ============================================================
-- Referral Security Hardening
-- Jalankan di Supabase SQL Editor SETELAH 002_referral.sql
-- ============================================================

-- 1. Tambah kolom security ke referral_users
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS pin_hash TEXT;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS pin_salt TEXT;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS pin_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS first_credit_at TIMESTAMPTZ;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS register_ip TEXT;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS register_fingerprint TEXT;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS last_withdraw_at TIMESTAMPTZ;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS banned BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE referral_users ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 2. Tambah kolom fraud detection ke referrals
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS fraud_score INTEGER NOT NULL DEFAULT 0;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS fraud_signals JSONB;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS requires_review BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;
ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reviewed_by TEXT;

-- 3. Each referee_phone hanya bisa jadi referee 1x (lifetime).
-- DIHAPUS: referral bisa dipakai berkali-kali oleh nomor yang sama.
DROP INDEX IF EXISTS idx_referrals_referee_unique;

-- 4. Device fingerprint tracking
CREATE TABLE IF NOT EXISTS referral_devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fingerprint TEXT NOT NULL,
  phone TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT,
  action TEXT NOT NULL, -- 'register', 'order', 'withdraw', 'login'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_devices_fingerprint ON referral_devices(fingerprint);
CREATE INDEX IF NOT EXISTS idx_devices_phone ON referral_devices(phone);
CREATE INDEX IF NOT EXISTS idx_devices_ip ON referral_devices(ip);
CREATE INDEX IF NOT EXISTS idx_devices_created ON referral_devices(created_at DESC);

-- 5. Audit log
CREATE TABLE IF NOT EXISTS referral_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT,
  action TEXT NOT NULL,
  result TEXT NOT NULL DEFAULT 'success', -- success | failed | blocked
  detail JSONB,
  ip TEXT,
  user_agent TEXT,
  fingerprint TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_phone ON referral_audit(phone, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON referral_audit(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_ip ON referral_audit(ip, created_at DESC);

-- 6. Rate limit table (sliding window)
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL DEFAULT 1,
  window_start TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_rate_limits_expires ON rate_limits(expires_at);

ALTER TABLE referral_devices ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE referral_devices FROM anon, authenticated;
REVOKE ALL ON TABLE referral_audit FROM anon, authenticated;
REVOKE ALL ON TABLE rate_limits FROM anon, authenticated;

-- 7. Update default config dengan policy keamanan baru
INSERT INTO settings (key, value, updated_at)
VALUES (
  'referral_security',
  '{
    "min_order_for_referral": 0,
    "withdraw_cooldown_hours": 24,
    "max_withdraw_per_day": 1,
    "pin_max_attempts": 5,
    "pin_lockout_minutes": 60,
    "fraud_threshold_review": 50,
    "fraud_threshold_block": 100
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Force update kalau setting sudah ada dari migration sebelumnya
UPDATE settings
SET value = jsonb_set(value, '{min_order_for_referral}', '0'::jsonb),
    updated_at = NOW()
WHERE key = 'referral_security';
