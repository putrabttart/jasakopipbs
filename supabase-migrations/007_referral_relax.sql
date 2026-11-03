-- ============================================================
-- Longgarkan policy referral & fraud detection
-- Anti-fraud yang terlalu strict mem-block saldo masuk legit user
-- ============================================================

-- Update referral_security: hapus cooldown, naikkan max per day, longgarkan fraud threshold
UPDATE settings
SET value = jsonb_build_object(
  'min_order_for_referral', 0,
  'withdraw_cooldown_hours', 0,
  'max_withdraw_per_day', 3,
  'pin_max_attempts', 5,
  'pin_lockout_minutes', 60,
  'fraud_threshold_review', 80,
  'fraud_threshold_block', 150
),
updated_at = NOW()
WHERE key = 'referral_security';

-- Insert kalau belum ada
INSERT INTO settings (key, value, updated_at)
VALUES (
  'referral_security',
  '{
    "min_order_for_referral": 0,
    "withdraw_cooldown_hours": 0,
    "max_withdraw_per_day": 3,
    "pin_max_attempts": 5,
    "pin_lockout_minutes": 60,
    "fraud_threshold_review": 80,
    "fraud_threshold_block": 150
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;

-- Pulihkan referral yang ter-flag review (recover saldo yang seharusnya sudah masuk)
-- Update referrals yang status pending tapi requires_review = true → set requires_review = false
-- Khusus untuk yang fraud_score < 80 (di bawah threshold baru)
UPDATE referrals
SET requires_review = false
WHERE status = 'pending'
  AND requires_review = true
  AND fraud_score < 80;
