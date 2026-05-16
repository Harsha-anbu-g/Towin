ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'ADMIN';

INSERT INTO users (id, email, password_hash, role, phone, trust_score, verification_status, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@towin.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2uheWG/igi.',
  'ADMIN',
  '+10000000001',
  0,
  'NONE',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;
