-- Reset the seeded admin account's password. BCrypt hash ($2a$, strength 10)
-- generated with the same Spring Security BCryptPasswordEncoder the app uses.
UPDATE users
SET password_hash = '$2a$10$ehvJoYVKUKwLyOnfKoUAouWl4xG9zZPbHUtXXiSXVkMJf3q9AQiaG',
    updated_at = NOW()
WHERE email = 'admin@towin.com';
