Safe schema-level constraints currently enforced in application/Drizzle schemas:

- `users.role`
  - allowed: `admin`, `production`, `qc`, `warehouse`, `sales`
- `tenants.billing_status`
  - allowed: `trialing`, `active`, `past_due`, `unpaid`, `incomplete`, `canceled`
- `tenants.subscription_interval`
  - allowed when present: `monthly`, `yearly`
- `payments.status`
  - allowed: `pending`, `approved`, `rejected`, `pending_review`
- `payments.method`
  - allowed: `instapay`, `vodafone_cash`
- `plan_prices.interval`
  - allowed: `monthly`, `yearly`
- `plan_prices.currency`
  - allowed: `EGP`, `USD`

Deliberately not constrained here yet:

- `tenants.current_plan`
  - dynamic and business-configurable
- `tenant_subscriptions.plan_id` semantics
  - already relationally constrained
- free-form provider fields like `payment_provider`
  - needs staged cleanup before tightening

Future improvement candidates:

- database-level `CHECK` constraints for the stable enums above
- staged normalization of `current_plan` to strict foreign-key usage only
- stricter monetary validation if/when all amounts move to integer minor units
