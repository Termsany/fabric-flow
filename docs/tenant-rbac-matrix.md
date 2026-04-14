# Tenant RBAC Matrix

This matrix documents the backend tenant-role access enforced for operational endpoints. Tenant admins are always allowed.

## Roles

- `tenant_admin`
- `production_user`
- `dyeing_user`
- `qc_user`
- `warehouse_user`
- `sales_user`

## Feature Access

| Feature | Read Roles | Write Roles |
| --- | --- | --- |
| Fabric rolls | production_user, dyeing_user, qc_user, warehouse_user, sales_user | production_user, dyeing_user, qc_user, warehouse_user |
| Production orders | production_user | production_user |
| Dyeing orders | dyeing_user | dyeing_user |
| QC reports | qc_user | qc_user |
| Warehouses + movements | warehouse_user | warehouse_user |
| Sales + customers | sales_user | sales_user |

## Notes

- `tenant_admin` can access all operational read/write endpoints.
- Platform admin roles are unchanged and handled separately in admin routes.
