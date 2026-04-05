ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS industry text NOT NULL DEFAULT 'textile',
  ADD COLUMN IF NOT EXISTS country text NOT NULL DEFAULT 'Egypt';

CREATE TABLE IF NOT EXISTS suppliers (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  name text NOT NULL,
  category text NOT NULL,
  contact_name text,
  phone text,
  email text,
  city text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS warehouse_locations (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  warehouse_id integer NOT NULL REFERENCES warehouses(id),
  code text NOT NULL,
  rack text NOT NULL,
  level text,
  section text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS invoices (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id),
  sales_order_id integer NOT NULL REFERENCES sales_orders(id),
  customer_id integer NOT NULL REFERENCES customers(id),
  invoice_number text NOT NULL UNIQUE,
  amount real NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  status text NOT NULL DEFAULT 'ISSUED',
  issued_at timestamptz NOT NULL DEFAULT now(),
  due_at timestamptz,
  paid_at timestamptz,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE fabric_rolls
  ADD COLUMN IF NOT EXISTS warehouse_location_id integer REFERENCES warehouse_locations(id);
