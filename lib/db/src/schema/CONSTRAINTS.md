Safe schema-level constraints currently enforced in application/Drizzle schemas:

- `users.role`
  - allowed: `tenant_admin`, `production_user`, `dyeing_user`, `qc_user`, `warehouse_user`, `sales_user`
  - legacy values still accepted: `admin`, `production`, `qc`, `warehouse`, `sales`
- `platform_admins.role`
  - allowed: `super_admin`, `support_admin`, `billing_admin`, `security_admin`, `readonly_admin`
- `tenants.billing_status`
  - allowed: `trialing`, `active`, `past_due`, `unpaid`, `incomplete`, `canceled`
- `tenants.subscription_interval`
  - allowed when present: `monthly`, `yearly`
- `production_orders.status`
  - allowed: `PENDING`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `dyeing_orders.status`
  - allowed: `PENDING`, `SENT`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`
- `sales_orders.status`
  - allowed: `DRAFT`, `CONFIRMED`, `INVOICED`, `DELIVERED`, `CANCELLED`
- `fabric_rolls.status`
  - allowed: `CREATED`, `IN_PRODUCTION`, `QC_PENDING`, `QC_PASSED`, `QC_FAILED`, `SENT_TO_DYEING`, `IN_DYEING`, `FINISHED`, `IN_STOCK`, `RESERVED`, `SOLD`
- `qc_reports.result`
  - allowed: `PASS`, `FAIL`, `SECOND`
- `invoices.status`
  - allowed: `ISSUED`, `PAID`, `OVERDUE`, `VOID`
- `payments.status`
  - allowed: `pending`, `approved`, `rejected`, `pending_review`
- `payments.method`
  - allowed: `instapay`, `vodafone_cash`
- `plan_prices.interval`
  - allowed: `monthly`, `yearly`
- `plan_prices.currency`
  - allowed: `EGP`, `USD`
- core required text inputs in insert schemas are trimmed and validated as non-empty for stable fields like:
  - `platform_admins.email`, `platform_admins.full_name`
  - `production_orders.order_number`, `fabric_type`, `raw_color`
  - `dyeing_orders.order_number`, `dyehouse_name`, `target_color`
  - `sales_orders.order_number`
  - `fabric_rolls.roll_code`, `batch_id`, `color`, `fabric_type`, `qr_code`
  - `invoices.invoice_number`

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
