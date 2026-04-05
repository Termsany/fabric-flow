CREATE TABLE IF NOT EXISTS plans (
  id serial PRIMARY KEY,
  code text NOT NULL,
  name_ar text NOT NULL,
  name_en text NOT NULL,
  description_ar text,
  description_en text,
  is_active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plans_code_unique ON plans(code);

CREATE TABLE IF NOT EXISTS plan_prices (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  interval text NOT NULL,
  currency text NOT NULL DEFAULT 'EGP',
  amount integer NOT NULL,
  trial_days integer NOT NULL DEFAULT 0,
  stripe_price_id text,
  local_payment_enabled boolean NOT NULL DEFAULT true,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS plan_prices_plan_interval_unique ON plan_prices(plan_id, interval);

CREATE TABLE IF NOT EXISTS plan_features (
  id serial PRIMARY KEY,
  plan_id integer NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  feature_key text NOT NULL,
  label_ar text NOT NULL,
  label_en text NOT NULL,
  included boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tenant_subscriptions (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_id integer NOT NULL REFERENCES plans(id),
  plan_price_id integer REFERENCES plan_prices(id),
  status text NOT NULL DEFAULT 'trialing',
  payment_provider text,
  payment_method_code text,
  started_at timestamptz NOT NULL DEFAULT now(),
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at_period_end boolean NOT NULL DEFAULT false,
  canceled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenant_subscriptions_tenant_unique ON tenant_subscriptions(tenant_id);

CREATE TABLE IF NOT EXISTS subscription_history (
  id serial PRIMARY KEY,
  tenant_id integer NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  tenant_subscription_id integer REFERENCES tenant_subscriptions(id) ON DELETE SET NULL,
  action text NOT NULL,
  from_plan_id integer REFERENCES plans(id),
  to_plan_id integer REFERENCES plans(id),
  from_status text,
  to_status text,
  actor_user_id integer REFERENCES users(id),
  actor_platform_admin_id integer REFERENCES platform_admins(id),
  notes text,
  metadata jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO plans (code, name_ar, name_en, description_ar, description_en, is_active, sort_order)
VALUES
  ('basic', 'الأساسية', 'Basic', 'إدارة أساسية للرولات والإنتاج للشركات الناشئة.', 'Core roll and production management for growing factories.', true, 1),
  ('pro', 'الاحترافية', 'Pro', 'مزايا متقدمة للجودة والصباغة والمبيعات والتقارير.', 'Advanced quality, dyeing, sales, and reporting workflows.', true, 2),
  ('enterprise', 'المؤسسية', 'Enterprise', 'حل متقدم بحدود أعلى وإدارة مخصصة.', 'Custom enterprise-grade setup with flexible limits.', true, 3)
ON CONFLICT (code) DO UPDATE SET
  name_ar = EXCLUDED.name_ar,
  name_en = EXCLUDED.name_en,
  description_ar = EXCLUDED.description_ar,
  description_en = EXCLUDED.description_en,
  is_active = EXCLUDED.is_active,
  sort_order = EXCLUDED.sort_order;

INSERT INTO plan_prices (plan_id, interval, currency, amount, trial_days, stripe_price_id, local_payment_enabled, is_active)
SELECT p.id, pricing.interval, 'EGP', pricing.amount, pricing.trial_days, pricing.stripe_price_id, true, true
FROM plans p
JOIN (
  VALUES
    ('basic', 'monthly', 49, 14, NULL),
    ('basic', 'yearly', 490, 14, NULL),
    ('pro', 'monthly', 149, 7, NULL),
    ('pro', 'yearly', 1490, 7, NULL),
    ('enterprise', 'monthly', 499, 0, NULL),
    ('enterprise', 'yearly', 4990, 0, NULL)
) AS pricing(plan_code, interval, amount, trial_days, stripe_price_id)
  ON pricing.plan_code = p.code
ON CONFLICT (plan_id, interval) DO UPDATE SET
  currency = EXCLUDED.currency,
  amount = EXCLUDED.amount,
  trial_days = EXCLUDED.trial_days,
  local_payment_enabled = EXCLUDED.local_payment_enabled,
  is_active = EXCLUDED.is_active;

DELETE FROM plan_features;

INSERT INTO plan_features (plan_id, feature_key, label_ar, label_en, included, sort_order)
SELECT p.id, feature_key, label_ar, label_en, true, sort_order
FROM plans p
JOIN (
  VALUES
    ('basic', 'rolls', 'إدارة الرولات', 'Roll management', 1),
    ('basic', 'production', 'أوامر الإنتاج', 'Production orders', 2),
    ('basic', 'users_5', 'حتى 5 مستخدمين', 'Up to 5 users', 3),
    ('basic', 'warehouses_1', 'مخزن واحد', 'Single warehouse', 4),
    ('pro', 'rolls', 'إدارة الرولات', 'Roll management', 1),
    ('pro', 'production', 'أوامر الإنتاج', 'Production orders', 2),
    ('pro', 'quality', 'مراقبة الجودة', 'Quality control', 3),
    ('pro', 'dyeing', 'إدارة الصباغة', 'Dyeing workflows', 4),
    ('pro', 'sales', 'المبيعات', 'Sales orders', 5),
    ('pro', 'users_20', 'حتى 20 مستخدمًا', 'Up to 20 users', 6),
    ('enterprise', 'all_modules', 'كل الوحدات', 'All modules', 1),
    ('enterprise', 'unlimited_users', 'عدد مستخدمين غير محدود', 'Unlimited users', 2),
    ('enterprise', 'unlimited_warehouses', 'عدد مخازن غير محدود', 'Unlimited warehouses', 3),
    ('enterprise', 'priority_support', 'دعم أولوية', 'Priority support', 4)
) AS features(plan_code, feature_key, label_ar, label_en, sort_order)
  ON features.plan_code = p.code;
