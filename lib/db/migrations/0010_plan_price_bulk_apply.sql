ALTER TABLE tenant_subscriptions
ADD COLUMN IF NOT EXISTS amount integer;

UPDATE tenant_subscriptions ts
SET amount = pp.amount
FROM plan_prices pp
WHERE ts.plan_price_id = pp.id
  AND (ts.amount IS NULL OR ts.amount <> pp.amount);
