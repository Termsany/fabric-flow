# Textile ERP Domain Model

This document describes the current domain model as implemented in the repository today. It is based on schema files, API routes/services, and frontend workflow screens only.

## FabricRoll

Source files:
- `lib/db/src/schema/fabric-rolls.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `artifacts/api-server/src/routes/qc-reports.ts`
- `artifacts/api-server/src/routes/dyeing-orders.ts`
- `artifacts/api-server/src/modules/sales/sales.service.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`

Purpose:
- Represents a physical roll of fabric tracked through production, QC, dyeing, warehousing, reservation, and sale.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `rollCode`
  - `batchId`
  - `productionOrderId`
  - `length`
  - `weight`
  - `color`
  - `gsm`
  - `width`
  - `fabricType`
  - `status`
  - `qrCode`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `warehouseId`
  - `warehouseLocationId`
  - `notes`

Relationships:
- Belongs to one `Tenant` through `tenantId`.
- Belongs to one `ProductionOrder` through `productionOrderId`.
- May be assigned to one `Warehouse` through `warehouseId`.
- May be assigned to one warehouse location through `warehouseLocationId`.
- Can have many `QCRecord` entries through `qc_reports.fabric_roll_id`.
- Can appear in many `WarehouseMovement` records through `warehouse_movements.fabric_roll_id`.
- Can be included in a `DyeingJob` through `dyeing_orders.roll_ids`.
- Can be included in a `Sale` through `sales_orders.roll_ids`.

Allowed statuses:
- `CREATED`
- `IN_PRODUCTION`
- `QC_PENDING`
- `QC_PASSED`
- `QC_FAILED`
- `SENT_TO_DYEING`
- `IN_DYEING`
- `FINISHED`
- `IN_STOCK`
- `RESERVED`
- `SOLD`
  Source: `lib/db/src/schema/domain-constraints.ts`

Lifecycle notes:
- QC creation updates the roll status:
  - `PASS` -> `QC_PASSED`
  - `FAIL` -> `QC_FAILED`
  - `SECOND` -> `QC_PENDING`
  Source: `artifacts/api-server/src/routes/qc-reports.ts`
- Dyeing order creation moves selected rolls to `SENT_TO_DYEING`.
  Source: `artifacts/api-server/src/routes/dyeing-orders.ts`
- Dyeing order completion moves selected rolls to `FINISHED`.
  Source: `artifacts/api-server/src/routes/dyeing-orders.ts`
- Sales order creation reserves selected rolls by setting them to `RESERVED`.
  Source: `artifacts/api-server/src/modules/sales/sales.service.ts`
- Sales order delivery marks selected rolls as `SOLD`.
  Source: `artifacts/api-server/src/modules/sales/sales.service.ts`
- Warehouse movement updates the roll’s warehouse assignment.
  Source: `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`

## ProductionOrder

Source files:
- `lib/db/src/schema/production-orders.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `artifacts/textile-erp/src/pages/ProductionOrdersPage.tsx`
- `artifacts/textile-erp/src/pages/ProductionOrderDetailPage.tsx`

Purpose:
- Represents a production request for a batch of fabric with target specifications and quantity.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `orderNumber`
  - `fabricType`
  - `gsm`
  - `width`
  - `rawColor`
  - `quantity`
  - `status`
  - `rollsGenerated`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `notes`

Relationships:
- Belongs to one `Tenant`.
- Can produce many `FabricRoll` records through `fabric_rolls.production_order_id`.

Allowed statuses:
- `PENDING`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
  Source: `lib/db/src/schema/domain-constraints.ts`

Lifecycle notes:
- Production orders are created from the production screen with fabric specs and quantity.
  Source: `artifacts/textile-erp/src/pages/ProductionOrdersPage.tsx`
- The detail page reads the order together with associated rolls by `productionOrderId`.
  Source: `artifacts/textile-erp/src/pages/ProductionOrderDetailPage.tsx`
- `rollsGenerated` tracks output count, but roll generation behavior is not centralized into a dedicated module yet.
  Source: `lib/db/src/schema/production-orders.ts`, `artifacts/api-server/src/routes/production-orders.ts`

## DyeingJob

Implemented in code as `DyeingOrder`.

Source files:
- `lib/db/src/schema/dyeing-orders.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `artifacts/api-server/src/routes/dyeing-orders.ts`
- `artifacts/textile-erp/src/pages/DyeingPage.tsx`

Purpose:
- Represents an external or internal dyeing work order for one or more rolls after QC approval.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `orderNumber`
  - `dyehouseName`
  - `targetColor`
  - `status`
  - `rollIds`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `targetShade`
  - `sentAt`
  - `receivedAt`
  - `notes`

Relationships:
- Belongs to one `Tenant`.
- References many `FabricRoll` records indirectly through the `rollIds` array.

Allowed statuses:
- `PENDING`
- `SENT`
- `IN_PROGRESS`
- `COMPLETED`
- `CANCELLED`
  Source: `lib/db/src/schema/domain-constraints.ts`

Lifecycle notes:
- The dyeing screen creates dyeing orders by selecting rolls that are already `QC_PASSED`.
  Source: `artifacts/textile-erp/src/pages/DyeingPage.tsx`
- On creation, selected rolls are marked `SENT_TO_DYEING`.
  Source: `artifacts/api-server/src/routes/dyeing-orders.ts`
- On completion, selected rolls are marked `FINISHED`.
  Source: `artifacts/api-server/src/routes/dyeing-orders.ts`
- The frontend currently offers a direct completion action for non-terminal orders.
  Source: `artifacts/textile-erp/src/pages/DyeingPage.tsx`

## QCRecord

Implemented in code as `QcReport`.

Source files:
- `lib/db/src/schema/qc-reports.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `artifacts/api-server/src/routes/qc-reports.ts`
- `artifacts/textile-erp/src/pages/QualityControlPage.tsx`

Purpose:
- Records the quality inspection result for a fabric roll.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `fabricRollId`
  - `inspectedById`
  - `result`
  - `defectCount`
  - `images`
  - `inspectedAt`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `defects`
  - `notes`

Relationships:
- Belongs to one `Tenant`.
- Belongs to one `FabricRoll`.
- Belongs to one `User` through `inspectedById`.

Allowed statuses:
- There is no separate QC record status field.
- The result enum is:
  - `PASS`
  - `FAIL`
  - `SECOND`
  Source: `lib/db/src/schema/domain-constraints.ts`

Lifecycle notes:
- QC reports are created from the QC screen by selecting rolls in `QC_PENDING`.
  Source: `artifacts/textile-erp/src/pages/QualityControlPage.tsx`
- Creating a QC record also updates the linked roll status.
  Source: `artifacts/api-server/src/routes/qc-reports.ts`
- The current update endpoint edits report fields, but does not re-run roll status synchronization after updates.
  Source: `artifacts/api-server/src/routes/qc-reports.ts`

## WarehouseMovement

Source files:
- `lib/db/src/schema/warehouse-movements.ts`
- `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`
- `artifacts/textile-erp/src/pages/WarehousePage.tsx`

Purpose:
- Records movement of a fabric roll between warehouses and updates the roll’s current warehouse.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `fabricRollId`
  - `movedById`
  - `movedAt`
  - `createdAt`
- Optional:
  - `fromWarehouseId`
  - `toWarehouseId`
  - `reason`

Relationships:
- Belongs to one `Tenant`.
- Belongs to one `FabricRoll`.
- References a source `Warehouse` through `fromWarehouseId`.
- References a destination `Warehouse` through `toWarehouseId`.
- Belongs to one `User` through `movedById`.

Allowed statuses:
- No explicit status field exists for warehouse movements.

Lifecycle notes:
- Warehouse movement creation validates the roll and warehouses for the tenant.
  Source: `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`
- Creating a movement updates the roll’s `warehouseId` to the destination warehouse.
  Source: `artifacts/api-server/src/modules/warehouses/warehouses.movements.ts`
- The warehouse screen creates movements using rolls filtered by `IN_STOCK`.
  Source: `artifacts/textile-erp/src/pages/WarehousePage.tsx`

## Sale

Implemented in code as `SalesOrder`.

Source files:
- `lib/db/src/schema/sales-orders.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `lib/db/src/schema/customers.ts`
- `artifacts/api-server/src/modules/sales/sales.service.ts`
- `artifacts/textile-erp/src/pages/SalesPage.tsx`

Purpose:
- Represents a customer-facing commercial order that reserves and ultimately sells one or more fabric rolls.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `orderNumber`
  - `customerId`
  - `status`
  - `totalAmount`
  - `rollIds`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `invoiceNumber`
  - `notes`

Relationships:
- Belongs to one `Tenant`.
- Belongs to one customer through `customerId`.
- References many `FabricRoll` records through `rollIds`.

Allowed statuses:
- `DRAFT`
- `CONFIRMED`
- `INVOICED`
- `DELIVERED`
- `CANCELLED`
  Source: `lib/db/src/schema/domain-constraints.ts`

Lifecycle notes:
- Sales orders are created from the sales screen using a customer, amount, and selected rolls in `IN_STOCK`.
  Source: `artifacts/textile-erp/src/pages/SalesPage.tsx`
- On creation, selected rolls are moved to `RESERVED`.
  Source: `artifacts/api-server/src/modules/sales/sales.service.ts`
- The frontend currently advances orders from `DRAFT` to `CONFIRMED`, then from `CONFIRMED` to `DELIVERED`.
  Source: `artifacts/textile-erp/src/pages/SalesPage.tsx`
- On delivery, the service marks linked rolls as `SOLD`.
  Source: `artifacts/api-server/src/modules/sales/sales.service.ts`

## Tenant

Source files:
- `lib/db/src/schema/tenants.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `artifacts/api-server/src/modules/auth/auth.logic.ts`
- `artifacts/api-server/src/modules/auth/auth.register.ts`

Purpose:
- Represents the top-level SaaS account and isolation boundary for a textile business.

Key fields:
- Required:
  - `id`
  - `name`
  - `industry`
  - `country`
  - `billingStatus`
  - `currentPlan`
  - `isActive`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `stripeCustomerId`
  - `stripeSubscriptionId`
  - `subscriptionInterval`
  - `subscriptionEndsAt`
  - `trialEndsAt`
  - `lastInvoiceStatus`
  - `maxUsersOverride`
  - `maxWarehousesOverride`

Relationships:
- One tenant has many `User` records.
- One tenant has many workflow entities: production orders, fabric rolls, QC records, dyeing orders, warehouses, customers, sales orders, invoices, payments, subscriptions, and payment method settings.
  Sources: `lib/db/src/schema/*.ts`

Allowed statuses:
- There is no generic tenant workflow status field.
- Billing status values are:
  - `trialing`
  - `active`
  - `past_due`
  - `unpaid`
  - `incomplete`
  - `canceled`
  Source: `lib/db/src/schema/domain-constraints.ts`
- Active state is also represented separately by `isActive: boolean`.
  Source: `lib/db/src/schema/tenants.ts`

Lifecycle notes:
- Tenant creation currently happens during registration together with creation of the first admin user.
  Source: `artifacts/api-server/src/modules/auth/auth.register.ts`
- New tenants are initialized with:
  - `currentPlan = "basic"`
  - `billingStatus = "trialing"`
  - a 14-day trial window
  Source: `artifacts/api-server/src/modules/auth/auth.logic.ts`
- Registration then runs post-creation provisioning for payment methods and subscription bootstrap.
  Source: `artifacts/api-server/src/modules/auth/auth.register.ts`

## User

Source files:
- `lib/db/src/schema/users.ts`
- `lib/db/src/schema/domain-constraints.ts`
- `artifacts/api-server/src/modules/auth/auth.logic.ts`
- `artifacts/textile-erp/src/pages/UsersPage.tsx`

Purpose:
- Represents a tenant-scoped application user who operates in one or more business functions.

Key fields:
- Required:
  - `id`
  - `tenantId`
  - `email`
  - `passwordHash`
  - `fullName`
  - `role`
  - `isActive`
  - `createdAt`
  - `updatedAt`
- Optional:
  - `lastLoginAt`
  - `passwordUpdatedAt`

Relationships:
- Belongs to one `Tenant`.
- Can author `QCRecord` entries through `inspectedById`.
- Can author `WarehouseMovement` entries through `movedById`.
- Can author tenant audit log entries in multiple route and service flows.

Allowed statuses:
- There is no user status enum.
- Activity state is represented by `isActive: boolean`.
- Allowed tenant user roles are:
  - `admin`
  - `production`
  - `qc`
  - `warehouse`
  - `sales`
  Source: `lib/db/src/schema/domain-constraints.ts`

Lifecycle notes:
- The first user for a new tenant is created during registration with role `admin`.
  Source: `artifacts/api-server/src/modules/auth/auth.logic.ts`
- The user management screen currently works with the same tenant-role set used in the schema.
  Source: `artifacts/textile-erp/src/pages/UsersPage.tsx`
- Platform admins are a separate model and are not stored in `users`.
  Source: `lib/db/src/schema/platform-admins.ts`, `lib/db/src/schema/domain-constraints.ts`

## Naming mismatches in current codebase

- `Sale` is implemented as `SalesOrder` in the schema and backend, while the frontend groups the domain under `SalesPage`.
  Files: `lib/db/src/schema/sales-orders.ts`, `artifacts/api-server/src/modules/sales/sales.service.ts`, `artifacts/textile-erp/src/pages/SalesPage.tsx`
- `QCRecord` is implemented as `QcReport` and persisted in `qc_reports`.
  Files: `lib/db/src/schema/qc-reports.ts`, `artifacts/api-server/src/routes/qc-reports.ts`, `artifacts/textile-erp/src/pages/QualityControlPage.tsx`
- `DyeingJob` or `DyeingStage` is implemented as `DyeingOrder`.
  Files: `lib/db/src/schema/dyeing-orders.ts`, `artifacts/api-server/src/routes/dyeing-orders.ts`, `artifacts/textile-erp/src/pages/DyeingPage.tsx`
- Tenant admin users and platform admins both use the word `admin`, but they are different models with different role sets.
  Files: `lib/db/src/schema/users.ts`, `lib/db/src/schema/platform-admins.ts`, `lib/db/src/schema/domain-constraints.ts`
- The backend has both `src/middleware` and deprecated `src/middlewares`, which is a naming inconsistency in infrastructure code.
  Files: `artifacts/api-server/src/middleware/index.ts`, `artifacts/api-server/src/middlewares/README.md`
- `WarehousePage` manages both warehouses and warehouse movements, while API naming splits them into `/warehouses` and `/warehouse-movements`.
  Files: `artifacts/textile-erp/src/pages/WarehousePage.tsx`, `artifacts/api-server/src/modules/warehouses/warehouses.routes.ts`
