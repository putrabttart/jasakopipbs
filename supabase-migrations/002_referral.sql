-- ===========================================================
-- Referral & Saldo System
-- Jalankan di Supabase SQL Editor
-- ===========================================================

-- 1. Tabel user referral (identitas = nomor WA, tanpa login)
CREATE TABLE IF NOT EXISTS referral_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT UNIQUE NOT NULL,
  name TEXT,
  referral_code TEXT UNIQUE NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  total_earned INTEGER NOT NULL DEFAULT 0 CHECK (total_earned >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_referral_users_code ON referral_users(referral_code);

-- 2. Tabel record referral (order yang pakai kode referral)
CREATE TABLE IF NOT EXISTS referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_phone TEXT NOT NULL,
  referrer_code TEXT NOT NULL,
  referee_phone TEXT,
  referee_name TEXT,
  order_id TEXT NOT NULL,
  reward INTEGER NOT NULL DEFAULT 2000 CHECK (reward >= 0),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'credited', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  credited_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_referrals_order ON referrals(order_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_phone);

-- 3. Tabel penarikan saldo
CREATE TABLE IF NOT EXISTS withdrawals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone TEXT NOT NULL,
  amount INTEGER NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  account_number TEXT NOT NULL,
  account_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'completed', 'rejected')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_withdrawals_phone ON withdrawals(phone);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON withdrawals(status);

DROP TRIGGER IF EXISTS trg_referral_users_updated_at ON referral_users;
CREATE TRIGGER trg_referral_users_updated_at
BEFORE UPDATE ON referral_users
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();

ALTER TABLE referral_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawals ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE referral_users FROM anon, authenticated;
REVOKE ALL ON TABLE referrals FROM anon, authenticated;
REVOKE ALL ON TABLE withdrawals FROM anon, authenticated;

-- 4. Konfigurasi referral di tabel settings (sudah ada)
-- Default: reward 2000, min withdraw 2000
INSERT INTO settings (key, value, updated_at)
VALUES (
  'referral_config',
  '{"reward": 2000, "min_withdraw": 2000, "enabled": true}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;
