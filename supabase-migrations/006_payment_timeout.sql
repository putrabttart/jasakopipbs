-- ============================================================
-- Payment timeout config — durasi sebelum order pending auto-cancel.
-- Default 30 menit.
-- ============================================================

INSERT INTO settings (key, value, updated_at)
VALUES (
  'payment_timeout',
  '{"minutes": 30}'::jsonb,
  NOW()
)
ON CONFLICT (key) DO NOTHING;
