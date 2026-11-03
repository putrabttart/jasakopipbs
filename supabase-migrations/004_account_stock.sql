-- ============================================================
-- Account stock configuration
-- One stock unit is consumed when an order is created and restored when the
-- order is cancelled.
-- ============================================================

INSERT INTO settings (key, value, updated_at)
VALUES (
  'account_stock',
  '{
    "count": 10,
    "message": "Mohon maaf, layanan sedang sibuk. Silakan coba lagi dalam beberapa saat ya.",
    "auto_manage": true,
    "enabled": true
  }'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;
