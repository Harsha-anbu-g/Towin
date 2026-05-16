INSERT INTO users (id, email, password_hash, role, phone, trust_score, verification_status, is_active, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@towin.com',
  '$2b$10$e.InvfIrAeiJxU.EIRXqRuwKACCigudUMyR6/C.1JAPJJ7Tb9/b4i',
  'ADMIN',
  '+10000000001',
  0,
  'NONE',
  true,
  NOW(),
  NOW()
) ON CONFLICT (email) DO NOTHING;
