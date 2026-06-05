CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(64),
    message TEXT NOT NULL,
    rating_idea INTEGER,
    rating_ui INTEGER,
    rating_theme INTEGER,
    rating_security INTEGER,
    rating_ease_of_use INTEGER,
    rating_performance INTEGER,
    rating_overall INTEGER,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);
