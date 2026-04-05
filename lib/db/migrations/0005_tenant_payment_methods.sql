CREATE TABLE IF NOT EXISTS tenant_payment_methods (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  method text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  account_number text,
  account_name text,
  instructions_ar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_payment_methods_tenant_method_unique
  ON tenant_payment_methods(tenant_id, method);
