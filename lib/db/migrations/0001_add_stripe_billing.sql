ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS billing_status text NOT NULL DEFAULT 'trialing',
  ADD COLUMN IF NOT EXISTS current_plan text NOT NULL DEFAULT 'basic',
  ADD COLUMN IF NOT EXISTS subscription_interval text,
  ADD COLUMN IF NOT EXISTS subscription_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS trial_ends_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_invoice_status text,
  ADD COLUMN IF NOT EXISTS max_users_override integer,
  ADD COLUMN IF NOT EXISTS max_warehouses_override integer;

CREATE TABLE IF NOT EXISTS billing_events (
  id serial PRIMARY KEY,
  tenant_id integer REFERENCES tenants(id),
  stripe_event_id text NOT NULL UNIQUE,
  type text NOT NULL,
  payload text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
