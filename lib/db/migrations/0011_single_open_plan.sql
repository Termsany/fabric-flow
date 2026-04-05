DO $$
DECLARE
  open_plan_id integer;
  monthly_price_id integer;
  yearly_price_id integer;
BEGIN
  INSERT INTO plans (code, name_ar, name_en, description_ar, description_en, is_active, sort_order)
  VALUES (
    'enterprise',
    'الخطة المفتوحة',
    'Open Plan',
    'خطة واحدة تشمل جميع المزايا والحدود المفتوحة لكل الشركات.',
    'A single open plan with all modules and broad limits for every tenant.',
    true,
    1
  )
  ON CONFLICT (code) DO UPDATE SET
    name_ar = EXCLUDED.name_ar,
    name_en = EXCLUDED.name_en,
    description_ar = EXCLUDED.description_ar,
    description_en = EXCLUDED.description_en,
    is_active = true,
    sort_order = 1,
    updated_at = now()
  RETURNING id INTO open_plan_id;

  DELETE FROM plan_features WHERE plan_id = open_plan_id;

  INSERT INTO plan_features (plan_id, feature_key, label_ar, label_en, included, sort_order)
  VALUES
    (open_plan_id, 'all_modules', 'كل الوحدات التشغيلية', 'All business modules', true, 1),
    (open_plan_id, 'unlimited_users', 'عدد مستخدمين مفتوح', 'Open user capacity', true, 2),
    (open_plan_id, 'unlimited_warehouses', 'عدد مخازن مفتوح', 'Open warehouse capacity', true, 3),
    (open_plan_id, 'advanced_reports', 'تقارير ومراقبة متقدمة', 'Advanced reports and monitoring', true, 4),
    (open_plan_id, 'manual_payments', 'الدفع اليدوي وطرق الدفع المحلية', 'Manual payments and local payment methods', true, 5);

  INSERT INTO plan_prices (plan_id, interval, currency, amount, trial_days, local_payment_enabled, is_active)
  VALUES (open_plan_id, 'monthly', 'EGP', 499, 0, true, true)
  ON CONFLICT (plan_id, interval) DO UPDATE SET
    currency = EXCLUDED.currency,
    amount = EXCLUDED.amount,
    trial_days = EXCLUDED.trial_days,
    local_payment_enabled = EXCLUDED.local_payment_enabled,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO monthly_price_id;

  INSERT INTO plan_prices (plan_id, interval, currency, amount, trial_days, local_payment_enabled, is_active)
  VALUES (open_plan_id, 'yearly', 'EGP', 4990, 0, true, true)
  ON CONFLICT (plan_id, interval) DO UPDATE SET
    currency = EXCLUDED.currency,
    amount = EXCLUDED.amount,
    trial_days = EXCLUDED.trial_days,
    local_payment_enabled = EXCLUDED.local_payment_enabled,
    is_active = EXCLUDED.is_active,
    updated_at = now()
  RETURNING id INTO yearly_price_id;

  UPDATE tenant_subscriptions ts
  SET
    plan_id = open_plan_id,
    plan_price_id = CASE
      WHEN COALESCE(t.subscription_interval, 'monthly') = 'yearly' THEN yearly_price_id
      ELSE monthly_price_id
    END,
    amount = CASE
      WHEN COALESCE(t.subscription_interval, 'monthly') = 'yearly' THEN 4990
      ELSE 499
    END,
    status = 'active',
    cancel_at_period_end = false,
    canceled_at = null,
    updated_at = now()
  FROM tenants t
  WHERE t.id = ts.tenant_id;

  UPDATE tenants
  SET
    current_plan = 'enterprise',
    billing_status = 'active',
    is_active = true,
    subscription_interval = COALESCE(subscription_interval, 'monthly'),
    updated_at = now();

  UPDATE subscription_history
  SET
    from_plan_id = open_plan_id,
    to_plan_id = open_plan_id
  WHERE from_plan_id IS NOT NULL OR to_plan_id IS NOT NULL;

  DELETE FROM plan_prices
  WHERE plan_id <> open_plan_id;

  DELETE FROM plan_features
  WHERE plan_id <> open_plan_id;

  DELETE FROM plans
  WHERE id <> open_plan_id;
END $$;
