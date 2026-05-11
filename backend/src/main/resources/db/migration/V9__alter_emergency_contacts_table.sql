ALTER TABLE emergency_contacts
    ALTER COLUMN name TYPE VARCHAR(255),
    ALTER COLUMN phone TYPE VARCHAR(30),
    ALTER COLUMN relationship DROP NOT NULL,
    ALTER COLUMN relationship TYPE VARCHAR(100);

ALTER TABLE emergency_contacts
    RENAME COLUMN inactivity_alert_days TO inactivity_days;

ALTER TABLE emergency_contacts
    ALTER COLUMN inactivity_days SET DEFAULT 5;

CREATE INDEX IF NOT EXISTS idx_emergency_contacts_elder ON emergency_contacts(elder_id);
