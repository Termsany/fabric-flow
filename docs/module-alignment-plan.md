# Backend Module Alignment Plan

This document audits `artifacts/api-server` against the repository's documented backend module pattern:

- `routes`
- `controller`
- `service`
- `repository`
- `validation`

Reference pattern:
- `docs/backend-module-pattern.md`

## Summary

The backend is currently in a mixed state:

- Fully module-oriented domains already exist under `src/modules`.
- Several legacy business features still live directly under `src/routes`.
- A few module-oriented domains are structurally aligned but still have internal responsibility leakage.

The largest structural gap is not in `auth`, `sales`, or `warehouses`. It is in route-heavy legacy domains such as `billing`, `admin-tenants`, `users`, `production-orders`, `fabric-rolls`, `qc-reports`, and `dyeing-orders`.

## Modules Already Aligned

### Auth

Status:
- Aligned

Why:
- Has explicit route, controller, service facade, focused use-case files, repository, and validation.
- Route file is thin and delegates cleanly.

Files:
- `artifacts/api-server/src/modules/auth/auth.routes.ts`
- `artifacts/api-server/src/modules/auth/auth.controller.ts`
- `artifacts/api-server/src/modules/auth/auth.service.ts`
- `artifacts/api-server/src/modules/auth/auth.login.ts`
- `artifacts/api-server/src/modules/auth/auth.register.ts`
- `artifacts/api-server/src/modules/auth/auth.current-user.ts`
- `artifacts/api-server/src/modules/auth/auth.change-password.ts`
- `artifacts/api-server/src/modules/auth/auth.repository.ts`
- `artifacts/api-server/src/modules/auth/auth.validation.ts`

Risk level:
- Low

Recommendation:
- Keep as reference implementation.
- Only continue small internal consistency cleanups when already touching the module.

### Warehouses

Status:
- Aligned

Why:
- Has route, controller, service facade, repository, validation, and focused use-case files for CRUD and movements.
- Route file is thin and responsibility split is clear.

Files:
- `artifacts/api-server/src/modules/warehouses/warehouses.routes.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.controller.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.service.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.crud.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.repository.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.validation.ts`

Risk level:
- Low

Recommendation:
- Keep current shape.
- If touched later, consider renaming `warehouses.crud.ts` and `warehouses.movements.ts` toward a more consistent `use-case` naming convention, but this is optional.

### Payment Methods

Status:
- Aligned

Why:
- Has route, controller, service, repository, validation, and typed module-local DTOs.
- Route wiring is thin and controller handles request parsing plus response mapping.

Files:
- `artifacts/api-server/src/modules/payment-methods/payment-methods.routes.ts`
- `artifacts/api-server/src/modules/payment-methods/payment-methods.controller.ts`
- `artifacts/api-server/src/modules/payment-methods/payment-methods.service.ts`
- `artifacts/api-server/src/modules/payment-methods/payment-methods.repository.ts`
- `artifacts/api-server/src/modules/payment-methods/payment-methods.validation.ts`
- `artifacts/api-server/src/modules/payment-methods/payment-methods.types.ts`

Risk level:
- Low

Recommendation:
- Keep current structure.
- Future cleanup can extract controller-local helpers like `parseTenantId` into module-local validation helpers, but there is no urgent mismatch.

## Modules Partially Aligned

### Sales

Status:
- Partially aligned

Why:
- Has route, controller, service, and repository.
- Does not yet have a module-local `sales.validation.ts`; controller validates directly with shared API zod schemas.
- This is functional and safe, but not fully aligned to the documented “validation local to module” pattern.

Files:
- `artifacts/api-server/src/modules/sales/sales.routes.ts`
- `artifacts/api-server/src/modules/sales/sales.controller.ts`
- `artifacts/api-server/src/modules/sales/sales.service.ts`
- `artifacts/api-server/src/modules/sales/sales.repository.ts`

Risk level:
- Low

Exact file-level refactor recommendations:
- Add `artifacts/api-server/src/modules/sales/sales.validation.ts`
  - Move `safeParse` calls or thin wrappers for params/body/query parsing out of `sales.controller.ts`.
- Keep `artifacts/api-server/src/modules/sales/sales.controller.ts`
  - Limit it to validation invocation, service orchestration, and HTTP mapping only.
- Keep `artifacts/api-server/src/modules/sales/sales.service.ts`
  - Continue holding business logic such as roll reservation and delivery-to-sold transitions.
- Keep `artifacts/api-server/src/modules/sales/sales.repository.ts`
  - It already owns data access cleanly.

Recommended order:
1. Add validation file.
2. Replace direct `safeParse` calls in controller with module-local parsing helpers.

### Plans

Status:
- Partially aligned

Why:
- Has route, controller, service, repository, validation, and types.
- However, service still reaches directly into `db` and schema tables for part of its work instead of pushing all DB access through the repository.
- Controller also composes payment method data in `getCurrentSubscription`, which slightly mixes feature boundaries.

Files:
- `artifacts/api-server/src/modules/plans/plans.routes.ts`
- `artifacts/api-server/src/modules/plans/plans.controller.ts`
- `artifacts/api-server/src/modules/plans/plans.service.ts`
- `artifacts/api-server/src/modules/plans/plans.repository.ts`
- `artifacts/api-server/src/modules/plans/plans.validation.ts`
- `artifacts/api-server/src/modules/plans/plans.types.ts`

Risk level:
- Medium

Exact file-level refactor recommendations:
- Update `artifacts/api-server/src/modules/plans/plans.service.ts`
  - Move direct `db`, `plansTable`, `planPricesTable`, `planFeaturesTable`, and `tenantSubscriptionsTable` access behind `plans.repository.ts`.
  - Keep business rules in service, but centralize transaction-aware persistence in repository helpers.
- Expand `artifacts/api-server/src/modules/plans/plans.repository.ts`
  - Add transaction-aware helpers for plan upsert and subscription persistence.
- Keep `artifacts/api-server/src/modules/plans/plans.controller.ts`
  - Consider reducing cross-module composition by delegating “current subscription + payment methods” assembly to the service layer.

Recommended order:
1. Extract transaction-backed persistence helpers into repository.
2. Trim service imports from raw DB schema/tables.
3. Optionally move `getCurrentSubscription` aggregation into service.

### Legacy Route Shims

Status:
- Partially aligned

Why:
- These files are only compatibility shims that re-export module routes, but they keep old path conventions alive in `src/routes`.

Files:
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/routes/sales.ts`
- `artifacts/api-server/src/routes/warehouses.ts`
- `artifacts/api-server/src/routes/settings-payment-methods.ts`

Risk level:
- Low

Exact file-level refactor recommendations:
- Keep as-is for now if they protect older imports.
- When import paths are cleaned up across the repo, either:
  - remove them, or
  - add a short comment in each shim explaining that it is a compatibility export.

## Modules Needing Refactor

These domains still live directly in `src/routes` and do not currently follow the documented module pattern.

### Production Orders

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/production-orders.ts`

Risk level:
- Medium

Exact file-level refactor recommendations:
- Create:
  - `artifacts/api-server/src/modules/production-orders/production-orders.routes.ts`
  - `artifacts/api-server/src/modules/production-orders/production-orders.controller.ts`
  - `artifacts/api-server/src/modules/production-orders/production-orders.service.ts`
  - `artifacts/api-server/src/modules/production-orders/production-orders.repository.ts`
  - `artifacts/api-server/src/modules/production-orders/production-orders.validation.ts`
- Start by moving formatting, validation, and DB reads/writes out of the current route file without changing route paths.

### Fabric Rolls

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/fabric-rolls.ts`

Risk level:
- Medium

Exact file-level refactor recommendations:
- Create:
  - `artifacts/api-server/src/modules/fabric-rolls/fabric-rolls.routes.ts`
  - `artifacts/api-server/src/modules/fabric-rolls/fabric-rolls.controller.ts`
  - `artifacts/api-server/src/modules/fabric-rolls/fabric-rolls.service.ts`
  - `artifacts/api-server/src/modules/fabric-rolls/fabric-rolls.repository.ts`
  - `artifacts/api-server/src/modules/fabric-rolls/fabric-rolls.validation.ts`
- Preserve current endpoint shapes.
- Pull tenant-scoped DB queries and warehouse validation into repository/service first.

### QC Reports

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/qc-reports.ts`

Risk level:
- Medium

Exact file-level refactor recommendations:
- Create:
  - `artifacts/api-server/src/modules/qc-reports/qc-reports.routes.ts`
  - `artifacts/api-server/src/modules/qc-reports/qc-reports.controller.ts`
  - `artifacts/api-server/src/modules/qc-reports/qc-reports.service.ts`
  - `artifacts/api-server/src/modules/qc-reports/qc-reports.repository.ts`
  - `artifacts/api-server/src/modules/qc-reports/qc-reports.validation.ts`
- Move QC result to fabric-roll status synchronization into service.
- Move report and roll queries into repository.

### Dyeing Orders

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/dyeing-orders.ts`

Risk level:
- Medium

Exact file-level refactor recommendations:
- Create:
  - `artifacts/api-server/src/modules/dyeing-orders/dyeing-orders.routes.ts`
  - `artifacts/api-server/src/modules/dyeing-orders/dyeing-orders.controller.ts`
  - `artifacts/api-server/src/modules/dyeing-orders/dyeing-orders.service.ts`
  - `artifacts/api-server/src/modules/dyeing-orders/dyeing-orders.repository.ts`
  - `artifacts/api-server/src/modules/dyeing-orders/dyeing-orders.validation.ts`
- Keep roll status transitions in service.
- Keep roll ownership checks and updates in repository/service rather than controller.

### Users

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/users.ts`

Risk level:
- Medium

Exact file-level refactor recommendations:
- Create:
  - `artifacts/api-server/src/modules/users/users.routes.ts`
  - `artifacts/api-server/src/modules/users/users.controller.ts`
  - `artifacts/api-server/src/modules/users/users.service.ts`
  - `artifacts/api-server/src/modules/users/users.repository.ts`
  - `artifacts/api-server/src/modules/users/users.validation.ts`
- Split password reset/update flows into either:
  - focused use-case files, or
  - a separate `users.passwords.ts` use-case helper if needed.

### Dashboard

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/dashboard.ts`

Risk level:
- Low

Exact file-level refactor recommendations:
- Create:
  - `artifacts/api-server/src/modules/dashboard/dashboard.routes.ts`
  - `artifacts/api-server/src/modules/dashboard/dashboard.controller.ts`
  - `artifacts/api-server/src/modules/dashboard/dashboard.service.ts`
  - `artifacts/api-server/src/modules/dashboard/dashboard.repository.ts`
- A dedicated validation file may be very small here, but still add one if query parsing grows.

### Admin Tenants

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/admin-tenants.ts`

Risk level:
- High

Why high:
- Very large route file with broad responsibilities: tenant listing, detail, billing operations, status changes, monitoring, impersonation, and admin dashboard concerns.

Exact file-level refactor recommendations:
- First split by subdomain before trying full pattern compliance:
  - `artifacts/api-server/src/modules/admin-tenants/admin-tenants.routes.ts`
  - `artifacts/api-server/src/modules/admin-tenants/admin-tenants.controller.ts`
  - `artifacts/api-server/src/modules/admin-tenants/admin-tenants.service.ts`
  - `artifacts/api-server/src/modules/admin-tenants/admin-tenants.repository.ts`
  - `artifacts/api-server/src/modules/admin-tenants/admin-tenants.validation.ts`
- Then consider internal sub-splits:
  - `admin-tenants.monitoring.ts`
  - `admin-tenants.billing.ts`
  - `admin-tenants.impersonation.ts`
- Keep response contracts unchanged while extracting.

### Billing

Status:
- Needs refactor

Files:
- `artifacts/api-server/src/routes/billing.ts`

Risk level:
- High

Why high:
- Very large route file mixing:
  - manual payment flows
  - Stripe checkout and portal flows
  - Stripe webhook handling
  - invoice/payment reads
  - admin payment review actions
  - helper functions and config access

Exact file-level refactor recommendations:
- Split into a module with at least:
  - `artifacts/api-server/src/modules/billing/billing.routes.ts`
  - `artifacts/api-server/src/modules/billing/billing.controller.ts`
  - `artifacts/api-server/src/modules/billing/billing.service.ts`
  - `artifacts/api-server/src/modules/billing/billing.repository.ts`
  - `artifacts/api-server/src/modules/billing/billing.validation.ts`
- Strongly consider focused internal files:
  - `billing.manual-payments.ts`
  - `billing.stripe.ts`
  - `billing.webhook.ts`
  - `billing.invoices.ts`
- Move `db` access and payment review updates behind repository boundaries before broader cleanup.

### Health

Status:
- Needs minimal refactor only if desired

Files:
- `artifacts/api-server/src/routes/health.ts`

Risk level:
- Low

Exact file-level refactor recommendations:
- Leave as-is unless the team wants every route under `src/modules`.
- If standardized later, move to:
  - `artifacts/api-server/src/modules/health/health.routes.ts`
- No repository or service layer is necessary unless health checks become stateful.

## Recommended Refactor Order

### First wave: safest, high-signal

1. `sales`
   - Add module-local validation file.
   - Lowest-risk step toward full compliance.
2. `production-orders`
   - Medium-sized business feature and a good candidate to mirror `sales`.
3. `fabric-rolls`
   - Naturally adjacent to production and already central to workflow.

### Second wave: controlled workflow modules

4. `qc-reports`
5. `dyeing-orders`
6. `users`
7. `dashboard`

### Third wave: large legacy extractions

8. `admin-tenants`
9. `billing`

## Very Small Safe Cleanup Opportunities

No code changes were required for this audit.

The only low-risk cleanup worth considering later without behavioral change is adding short compatibility comments to these route shim files:
- `artifacts/api-server/src/routes/auth.ts`
- `artifacts/api-server/src/routes/sales.ts`
- `artifacts/api-server/src/routes/warehouses.ts`
- `artifacts/api-server/src/routes/settings-payment-methods.ts`

That can wait until the next touch on those files.
