ALTER TABLE users
  ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

CREATE TABLE IF NOT EXISTS platform_admins (
  id serial PRIMARY KEY,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  full_name text NOT NULL,
  role text NOT NULL DEFAULT 'readonly_admin',
  is_active boolean NOT NULL DEFAULT true,
  last_login_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id serial PRIMARY KEY,
  platform_admin_id integer REFERENCES platform_admins(id),
  admin_email text NOT NULL,
  admin_role text NOT NULL,
  action text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  target_tenant_id integer,
  severity text NOT NULL DEFAULT 'info',
  metadata text,
  created_at timestamptz NOT NULL DEFAULT now()
);
