ALTER TABLE payment_method_definitions
  RENAME COLUMN method TO code;

ALTER TABLE payment_method_definitions
  RENAME COLUMN is_active TO is_globally_enabled;

ALTER TABLE payment_method_definitions
  ADD COLUMN IF NOT EXISTS name_ar text,
  ADD COLUMN IF NOT EXISTS name_en text,
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS supports_manual_review boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

UPDATE payment_method_definitions
SET
  name_ar = CASE code
    WHEN 'instapay' THEN 'إنستا باي'
    WHEN 'vodafone_cash' THEN 'فودافون كاش'
    ELSE coalesce(name_ar, code)
  END,
  name_en = CASE code
    WHEN 'instapay' THEN 'InstaPay'
    WHEN 'vodafone_cash' THEN 'Vodafone Cash'
    ELSE coalesce(name_en, code)
  END,
  category = 'manual',
  supports_manual_review = true,
  sort_order = CASE code
    WHEN 'instapay' THEN 1
    WHEN 'vodafone_cash' THEN 2
    ELSE 99
  END
WHERE name_ar IS NULL OR name_en IS NULL;

ALTER TABLE payment_method_definitions
  ALTER COLUMN name_ar SET NOT NULL,
  ALTER COLUMN name_en SET NOT NULL;

DROP INDEX IF EXISTS payment_method_definitions_method_unique;
CREATE UNIQUE INDEX IF NOT EXISTS payment_method_definitions_code_unique
  ON payment_method_definitions(code);
CREATE INDEX IF NOT EXISTS payment_method_definitions_code_idx
  ON payment_method_definitions(code);

ALTER TABLE tenant_payment_methods
  RENAME COLUMN method TO payment_method_code;

ALTER TABLE tenant_payment_methods
  ADD COLUMN IF NOT EXISTS instructions_en text,
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_by integer REFERENCES users(id);

DROP INDEX IF EXISTS tenant_payment_methods_tenant_method_unique;
CREATE UNIQUE INDEX IF NOT EXISTS tenant_payment_methods_tenant_method_unique
  ON tenant_payment_methods(tenant_id, payment_method_code);
CREATE INDEX IF NOT EXISTS tenant_payment_methods_tenant_id_idx
  ON tenant_payment_methods(tenant_id);
CREATE INDEX IF NOT EXISTS tenant_payment_methods_payment_method_code_idx
  ON tenant_payment_methods(payment_method_code);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'tenant_payment_methods_payment_method_code_fkey'
      AND table_name = 'tenant_payment_methods'
  ) THEN
    ALTER TABLE tenant_payment_methods DROP CONSTRAINT tenant_payment_methods_payment_method_code_fkey;
  END IF;
END $$;

ALTER TABLE tenant_payment_methods
  ADD CONSTRAINT tenant_payment_methods_payment_method_code_fkey
  FOREIGN KEY (payment_method_code) REFERENCES payment_method_definitions(code);

CREATE TABLE IF NOT EXISTS payment_method_audit_logs (
  id serial PRIMARY KEY,
  actor_user_id integer REFERENCES users(id),
  actor_platform_admin_id integer REFERENCES platform_admins(id),
  actor_name text NOT NULL,
  actor_role text NOT NULL,
  tenant_id integer REFERENCES tenants(id),
  payment_method_code text NOT NULL,
  action text NOT NULL,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payment_method_audit_logs
  ADD COLUMN IF NOT EXISTS actor_name text;

CREATE INDEX IF NOT EXISTS payment_method_audit_logs_tenant_created_idx
  ON payment_method_audit_logs(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payment_method_audit_logs_code_idx
  ON payment_method_audit_logs(payment_method_code);

INSERT INTO payment_method_definitions (
  code,
  name_ar,
  name_en,
  category,
  is_globally_enabled,
  supports_manual_review,
  sort_order
)
VALUES
  ('instapay', 'إنستا باي', 'InstaPay', 'manual', true, true, 1),
  ('vodafone_cash', 'فودافون كاش', 'Vodafone Cash', 'manual', true, true, 2)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  category = EXCLUDED.category,
  supports_manual_review = EXCLUDED.supports_manual_review,
  sort_order = EXCLUDED.sort_order;
