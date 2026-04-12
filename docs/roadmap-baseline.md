# Textile ERP Baseline Roadmap

This baseline is derived from actual code under `artifacts/textile-erp`, `artifacts/api-server`, `lib/db`, and `docs`.

## 1. Current Architecture

- Frontend is a React SPA using Wouter routing, React Query, shared generated API hooks, and a shared auth context.
  Files: `artifacts/textile-erp/src/App.tsx`, `artifacts/textile-erp/src/contexts/AuthContext.tsx`, `artifacts/textile-erp/src/lib/api-client.ts`
- Backend is an Express API mounted under `/api`, with app-level logging, CORS handling, security headers, static upload serving for local storage, and centralized error handling.
  Files: `artifacts/api-server/src/app.ts`, `artifacts/api-server/src/routes/index.ts`
- Backend architecture is mixed:
  - Feature-module pattern exists for `auth`, `sales`, `warehouses`, `plans`, and `payment-methods`.
    Files: `artifacts/api-server/src/modules/auth/*`, `artifacts/api-server/src/modules/sales/*`, `artifacts/api-server/src/modules/warehouses/*`, `artifacts/api-server/src/modules/plans/*`, `artifacts/api-server/src/modules/payment-methods/*`
  - Legacy route-heavy features still live directly in `src/routes`.
    Files: `artifacts/api-server/src/routes/production-orders.ts`, `artifacts/api-server/src/routes/fabric-rolls.ts`, `artifacts/api-server/src/routes/qc-reports.ts`, `artifacts/api-server/src/routes/dyeing-orders.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/routes/dashboard.ts`, `artifacts/api-server/src/routes/admin-tenants.ts`, `artifacts/api-server/src/routes/billing.ts`
- Database access is centralized through Drizzle schema files and a shared DB package.
  Files: `lib/db/src/index.ts`, `lib/db/src/schema/index.ts`
- Existing architecture notes document the intended module direction and the auth module as the current reference implementation.
  Files: `docs/backend-module-pattern.md`, `docs/auth-module.md`

## 2. Existing Pages And Routes

### Frontend pages registered in the SPA router

- Public routes:
  - `/login`
  - `/register`
  - `/pricing`
  Files: `artifacts/textile-erp/src/App.tsx`, `artifacts/textile-erp/src/pages/LoginPage.tsx`, `artifacts/textile-erp/src/pages/RegisterPage.tsx`, `artifacts/textile-erp/src/pages/PricingPage.tsx`
- Tenant-facing authenticated routes:
  - `/dashboard`
  - `/fabric-rolls`
  - `/fabric-rolls/:id`
  - `/production-orders`
  - `/production-orders/:id`
  - `/qc`
  - `/dyeing`
  - `/warehouses`
  - `/sales`
  - `/users`
  - `/audit-logs`
  - `/billing`
  - `/subscription`
  - `/billing/pay`
  - `/profile/security`
  Files: `artifacts/textile-erp/src/App.tsx`
- Platform admin routes:
  - `/admin/plans`
  - `/admin/tenants`
  - `/admin/tenants/:id`
  - `/admin/tenants/:id/payment-methods`
  - `/admin/payment-methods`
  - `/admin/billing`
  - `/admin/payments`
  - `/admin/monitoring`
  Files: `artifacts/textile-erp/src/App.tsx`

### Frontend navigation currently exposed in the layout

- Tenant nav links include dashboard, fabric rolls, production orders, QC, dyeing, warehouses, sales, profile security, and for tenant admins also subscription, manual payment, users, audit logs, and billing.
  File: `artifacts/textile-erp/src/components/Layout.tsx`
- Platform admin nav links include tenants, plans, payment methods, billing, payments, and monitoring.
  File: `artifacts/textile-erp/src/components/Layout.tsx`

### Backend route groups mounted under `/api`

- Health: `/health`, `/healthz`
  File: `artifacts/api-server/src/routes/health.ts`
- Auth: `/auth/login`, `/auth/register`, `/auth/logout`, `/auth/me`, `/auth/change-password`
  File: `artifacts/api-server/src/modules/auth/auth.routes.ts`
- Users:
  - `/users`
  - `/users/:id`
  - `/admin/users/:id/password`
  - `/admin/tenants/:tenantId/users/:id/password`
  File: `artifacts/api-server/src/routes/users.ts`
- Production:
  - `/production-orders`
  - `/production-orders/:id`
  File: `artifacts/api-server/src/routes/production-orders.ts`
- Fabric rolls:
  - `/fabric-rolls`
  - `/fabric-rolls/by-code/:rollCode`
  - `/fabric-rolls/:id`
  File: `artifacts/api-server/src/routes/fabric-rolls.ts`
- QC:
  - `/qc-reports`
  - `/qc-reports/:id`
  File: `artifacts/api-server/src/routes/qc-reports.ts`
- Dyeing:
  - `/dyeing-orders`
  - `/dyeing-orders/:id`
  File: `artifacts/api-server/src/routes/dyeing-orders.ts`
- Warehouses and movements:
  - `/warehouses`
  - `/warehouses/:id`
  - `/warehouse-movements`
  File: `artifacts/api-server/src/modules/warehouses/warehouses.routes.ts`
- Sales and customers:
  - `/customers`
  - `/customers/:id`
  - `/sales-orders`
  - `/sales-orders/:id`
  File: `artifacts/api-server/src/modules/sales/sales.routes.ts`
- Dashboard and audit:
  - `/dashboard/stats`
  - `/dashboard/roll-status-breakdown`
  - `/dashboard/recent-activity`
  - `/dashboard/production-by-month`
  - `/audit-logs`
  File: `artifacts/api-server/src/routes/dashboard.ts`
- Billing, payments, checkout, webhook:
  Files: `artifacts/api-server/src/routes/billing.ts`, `artifacts/api-server/src/modules/plans/plans.routes.ts`, `artifacts/api-server/src/modules/payment-methods/payment-methods.routes.ts`
- Platform admin tenants and monitoring:
  Files: `artifacts/api-server/src/routes/admin-tenants.ts`

## 3. Existing Backend Feature Coverage

- `auth` is the most complete reference module with routes, controller, facade service, focused use-case files, repository, validation, mappers, support utilities, and tests.
  Files: `artifacts/api-server/src/modules/auth/*`, `docs/auth-module.md`
- `sales` is module-structured and covers customers plus sales orders, including tests.
  Files: `artifacts/api-server/src/modules/sales/sales.routes.ts`, `artifacts/api-server/src/modules/sales/sales.controller.ts`, `artifacts/api-server/src/modules/sales/sales.service.ts`, `artifacts/api-server/src/modules/sales/sales.repository.ts`, `artifacts/api-server/src/modules/sales/sales.service.test.ts`
- `warehouses` is module-structured and covers warehouses plus warehouse movements, including tests.
  Files: `artifacts/api-server/src/modules/warehouses/warehouses.routes.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.controller.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.crud.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.repository.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.service.test.ts`
- `plans` is module-structured and covers public plans, admin plan management, and tenant subscription actions.
  Files: `artifacts/api-server/src/modules/plans/*`
- `payment-methods` is module-structured and covers global payment methods, tenant overrides, and tenant-facing billing payment methods.
  Files: `artifacts/api-server/src/modules/payment-methods/*`
- The following backend features are implemented but still route-heavy rather than module-structured:
  - production orders
  - fabric rolls
  - QC reports
  - dyeing orders
  - users
  - dashboard
  - admin tenants
  - billing
  Files: `artifacts/api-server/src/routes/production-orders.ts`, `artifacts/api-server/src/routes/fabric-rolls.ts`, `artifacts/api-server/src/routes/qc-reports.ts`, `artifacts/api-server/src/routes/dyeing-orders.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/routes/dashboard.ts`, `artifacts/api-server/src/routes/admin-tenants.ts`, `artifacts/api-server/src/routes/billing.ts`

## 4. Data Entities Already Implemented

### Core tenant and auth entities

- `tenants`
- `users`
- `platform_admins`
- `admin_audit_logs`
- `audit_logs`
  Files: `lib/db/src/schema/tenants.ts`, `lib/db/src/schema/users.ts`, `lib/db/src/schema/platform-admins.ts`, `lib/db/src/schema/admin-audit-logs.ts`, `lib/db/src/schema/audit-logs.ts`

### Production workflow entities

- `production_orders`
- `fabric_rolls`
- `qc_reports`
- `dyeing_orders`
- `warehouses`
- `warehouse_locations`
- `warehouse_movements`
  Files: `lib/db/src/schema/production-orders.ts`, `lib/db/src/schema/fabric-rolls.ts`, `lib/db/src/schema/qc-reports.ts`, `lib/db/src/schema/dyeing-orders.ts`, `lib/db/src/schema/warehouses.ts`, `lib/db/src/schema/warehouse-locations.ts`, `lib/db/src/schema/warehouse-movements.ts`

### Sales and commercial entities

- `customers`
- `suppliers`
- `sales_orders`
- `invoices`
- `payments`
  Files: `lib/db/src/schema/customers.ts`, `lib/db/src/schema/suppliers.ts`, `lib/db/src/schema/sales-orders.ts`, `lib/db/src/schema/invoices.ts`, `lib/db/src/schema/payments.ts`

### Billing and subscription entities

- `plans`
- `plan_prices`
- `plan_features`
- `tenant_subscriptions`
- `subscription_history`
- `billing_events`
- `payment_method_definitions`
- `tenant_payment_methods`
- `payment_method_audit_logs`
  Files: `lib/db/src/schema/plans.ts`, `lib/db/src/schema/plan-prices.ts`, `lib/db/src/schema/plan-features.ts`, `lib/db/src/schema/tenant-subscriptions.ts`, `lib/db/src/schema/subscription-history.ts`, `lib/db/src/schema/billing-events.ts`, `lib/db/src/schema/payment-method-definitions.ts`, `lib/db/src/schema/tenant-payment-methods.ts`, `lib/db/src/schema/payment-method-audit-logs.ts`

### Additional schema-level constraint documentation

- Current safe schema and validation constraints are documented separately.
  File: `lib/db/src/schema/CONSTRAINTS.md`

## 5. Missing Workflow Links

- `PaymentSettingsPage` exists but is not registered in the frontend router and is not linked from the main layout.
  Files: `artifacts/textile-erp/src/pages/PaymentSettingsPage.tsx`, `artifacts/textile-erp/src/App.tsx`, `artifacts/textile-erp/src/components/Layout.tsx`
- The database includes `suppliers`, but there is no matching API route or frontend page under `artifacts/api-server/src` or `artifacts/textile-erp/src/pages`.
  Files: `lib/db/src/schema/suppliers.ts`, `artifacts/api-server/src/routes/index.ts`
- The database includes `warehouse_locations`, but there is no matching API route or frontend page under `artifacts/api-server/src` or `artifacts/textile-erp/src/pages`.
  Files: `lib/db/src/schema/warehouse-locations.ts`, `artifacts/api-server/src/routes/index.ts`
- Frontend detail workflows exist for production orders and fabric rolls only. There are backend item endpoints for customers, sales orders, warehouses, users, QC reports, and dyeing orders, but no corresponding frontend route registrations in the SPA router.
  Files: `artifacts/textile-erp/src/App.tsx`, `artifacts/api-server/src/modules/sales/sales.routes.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.routes.ts`, `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/routes/qc-reports.ts`, `artifacts/api-server/src/routes/dyeing-orders.ts`
- Several tenant workflows currently stop at list-and-edit screens rather than cross-feature drill-down screens. For example, `SalesPage`, `QualityControlPage`, `DyeingPage`, and `WarehousePage` are registered as top-level pages, but only production orders and fabric rolls link onward to dedicated detail routes.
  Files: `artifacts/textile-erp/src/pages/SalesPage.tsx`, `artifacts/textile-erp/src/pages/QualityControlPage.tsx`, `artifacts/textile-erp/src/pages/DyeingPage.tsx`, `artifacts/textile-erp/src/pages/WarehousePage.tsx`, `artifacts/textile-erp/src/pages/ProductionOrdersPage.tsx`, `artifacts/textile-erp/src/pages/FabricRollsPage.tsx`

## 6. Technical Debt Hotspots

- Backend route files remain very large in a few areas, which makes them the highest-maintenance zones:
  - `artifacts/api-server/src/routes/billing.ts` is 961 lines
  - `artifacts/api-server/src/routes/admin-tenants.ts` is 854 lines
  - `artifacts/api-server/src/routes/users.ts` is 276 lines
  Files: `artifacts/api-server/src/routes/billing.ts`, `artifacts/api-server/src/routes/admin-tenants.ts`, `artifacts/api-server/src/routes/users.ts`
- Route-style architecture is still inconsistent across the backend. Newer features use `src/modules/*`, while many older domains still live directly in `src/routes/*`.
  Files: `artifacts/api-server/src/routes/index.ts`, `docs/backend-module-pattern.md`
- Middleware naming is still transitional: both `src/middleware` and `src/middlewares` exist, with `src/middlewares` marked deprecated.
  Files: `artifacts/api-server/src/middleware/index.ts`, `artifacts/api-server/src/middlewares/README.md`
- Auth is well-documented and tested, but that depth is not yet matched across the rest of the workflow modules.
  Files: `docs/auth-module.md`, `artifacts/api-server/src/modules/auth/auth.service.test.ts`, `artifacts/api-server/src/modules/sales/sales.service.test.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.service.test.ts`
- Frontend route coverage is uneven. The router includes many top-level screens, but only a subset have dedicated detail pages or deeper drill-down flows.
  Files: `artifacts/textile-erp/src/App.tsx`, `artifacts/textile-erp/src/pages/FabricRollDetailPage.tsx`, `artifacts/textile-erp/src/pages/ProductionOrderDetailPage.tsx`
- Billing logic is spread across multiple backend surfaces:
  - subscription and plan actions in `modules/plans`
  - payment method management in `modules/payment-methods`
  - manual payments, Stripe flows, invoices, and webhooks in `routes/billing.ts`
  Files: `artifacts/api-server/src/modules/plans/plans.routes.ts`, `artifacts/api-server/src/modules/payment-methods/payment-methods.routes.ts`, `artifacts/api-server/src/routes/billing.ts`

## 7. Recommended Implementation Order For The Next 30 Days

### Week 1: tighten workflow visibility and remove orphaned edges

- Decide whether `PaymentSettingsPage` should be wired into the app or removed from the active page set.
  Files: `artifacts/textile-erp/src/pages/PaymentSettingsPage.tsx`, `artifacts/textile-erp/src/App.tsx`, `artifacts/textile-erp/src/components/Layout.tsx`
- Document or backlog `suppliers` and `warehouse_locations` explicitly, because both exist at the schema layer without an API/UI workflow.
  Files: `lib/db/src/schema/suppliers.ts`, `lib/db/src/schema/warehouse-locations.ts`

### Week 2: refactor one large workflow-heavy backend area

- Start with `users` or `production-orders`, because both are tenant-facing workflow areas and are materially smaller than `billing` and `admin-tenants`.
  Files: `artifacts/api-server/src/routes/users.ts`, `artifacts/api-server/src/routes/production-orders.ts`
- Apply the existing backend module pattern rather than inventing a new one.
  Files: `docs/backend-module-pattern.md`, `artifacts/api-server/src/modules/auth/*`, `artifacts/api-server/src/modules/sales/*`, `artifacts/api-server/src/modules/warehouses/*`

### Week 3: add missing drill-down workflows

- Add detail-page coverage for one or two domains that already have backend item endpoints, starting with sales orders or warehouses.
  Files: `artifacts/api-server/src/modules/sales/sales.routes.ts`, `artifacts/api-server/src/modules/warehouses/warehouses.routes.ts`, `artifacts/textile-erp/src/App.tsx`
- This will connect existing data more tightly without requiring new schema work.
  Files: `artifacts/textile-erp/src/pages/SalesPage.tsx`, `artifacts/textile-erp/src/pages/WarehousePage.tsx`

### Week 4: reduce the largest backend risk area incrementally

- Begin splitting `billing.ts` or `admin-tenants.ts` into module-oriented seams, but in small patches only.
  Files: `artifacts/api-server/src/routes/billing.ts`, `artifacts/api-server/src/routes/admin-tenants.ts`
- Keep route contracts unchanged and peel out controller/service/repository boundaries gradually.
  Files: `docs/backend-module-pattern.md`

## Summary

- The repo already supports a substantial tenant workflow across auth, production, QC, dyeing, warehouses, sales, users, billing, plans, and platform administration.
- The clearest next-value work is not new schema creation; it is connecting and standardizing what already exists.
- The highest-leverage sequence is:
  1. remove orphaned or ambiguous workflow edges
  2. refactor one medium-sized legacy route area
  3. add missing frontend drill-down routes where backend item endpoints already exist
  4. then tackle the largest backend route files in controlled increments
