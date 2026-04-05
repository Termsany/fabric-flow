CREATE TABLE IF NOT EXISTS payments (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  amount real NOT NULL,
  method text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  reference_number text NOT NULL,
  proof_image_url text NOT NULL,
  created_by integer NOT NULL REFERENCES users(id),
  reviewed_by integer REFERENCES platform_admins(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_tenant_id_idx ON payments(tenant_id);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments(status);
CREATE UNIQUE INDEX IF NOT EXISTS payments_pending_reference_unique
  ON payments(tenant_id, reference_number)
  WHERE status = 'pending';
