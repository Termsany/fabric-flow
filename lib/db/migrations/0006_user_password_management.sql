ALTER TABLE users
ADD COLUMN IF NOT EXISTS password_updated_at timestamptz;
