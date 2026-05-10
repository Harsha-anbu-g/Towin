CREATE TYPE connection_type AS ENUM ('SOCIAL', 'SERVICE');
CREATE TYPE connection_status AS ENUM ('PENDING', 'ACTIVE', 'PAUSED', 'DECLINED', 'ENDED');

CREATE TABLE connections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_a UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    user_b UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type connection_type NOT NULL DEFAULT 'SOCIAL',
    status connection_status NOT NULL DEFAULT 'PENDING',
    current_trust_level INTEGER NOT NULL DEFAULT 0,
    initiated_by UUID NOT NULL REFERENCES users(id),
    request_message TEXT,
    confirmed_by_a BOOLEAN NOT NULL DEFAULT FALSE,
    confirmed_by_b BOOLEAN NOT NULL DEFAULT FALSE,
    is_paused_by UUID REFERENCES users(id),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT no_self_connection CHECK (user_a != user_b),
    CONSTRAINT unique_connection UNIQUE (user_a, user_b)
);

CREATE INDEX idx_connections_user_a ON connections(user_a);
CREATE INDEX idx_connections_user_b ON connections(user_b);
CREATE INDEX idx_connections_status ON connections(status);
