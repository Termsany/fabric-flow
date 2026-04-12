# Tenant Role Matrix

This document summarizes the tenant-scoped operational roles enforced across the API and UI.
Platform admin roles (super/support/billing/security/readonly) remain unchanged and are not listed here.

## Tenant Roles

- `tenant_admin` (full tenant access)
- `production_user`
- `dyeing_user`
- `qc_user`
- `warehouse_user`
- `sales_user`

Legacy roles (`admin`, `production`, `dyeing`, `qc`, `warehouse`, `sales`) are still accepted and normalized to the roles above.

## Operational Feature Access

Read access generally follows feature ownership plus tenant admin override. Write access is restricted to the owning role plus tenant admin.

- Dashboard metrics: all tenant roles
- Fabric rolls:
  - Read/list/detail: all tenant roles
  - Write/update: production, dyeing, QC, warehouse, tenant admin
- Production orders:
  - Read/write: production, tenant admin
- Dyeing orders:
  - Read/write: dyeing, tenant admin
- QC reports:
  - Read/write: QC, tenant admin
- Warehouses + movements:
  - Read/write: warehouse, tenant admin
- Sales + customers:
  - Read/write: sales, tenant admin
- Users (tenant user management):
  - Read/write: tenant admin only
- Billing + subscription:
  - Read/write: tenant admin only

## Notes for Operators

- New tenants are provisioned with a `tenant_admin` user.
- Assign tenant roles via the Users page using the exact role names above.
- Legacy roles are supported for compatibility but should be migrated to the new roles over time.
