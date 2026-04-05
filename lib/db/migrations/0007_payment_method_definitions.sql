CREATE TABLE IF NOT EXISTS payment_method_definitions (
  id serial PRIMARY KEY,
  method text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  account_number text,
  account_name text,
  instructions_ar text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS payment_method_definitions_method_unique
  ON payment_method_definitions(method);

INSERT INTO payment_method_definitions (method, is_active, account_number, account_name, instructions_ar)
VALUES
  ('instapay', true, NULL, NULL, NULL),
  ('vodafone_cash', true, NULL, NULL, NULL)
ON CONFLICT (method) DO NOTHING;
