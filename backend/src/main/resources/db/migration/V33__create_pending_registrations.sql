-- Staging table for manual signups awaiting email verification. The real users
-- row is created only when the link is clicked; the pending row is then deleted.
CREATE TABLE pending_registrations (
    id UUID PRIMARY KEY,
    username VARCHAR(30) NOT NULL,
    email VARCHAR(255) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    date_of_birth DATE,
    token VARCHAR(255) NOT NULL UNIQUE,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT now()
);
CREATE INDEX idx_pending_email ON pending_registrations(email);
