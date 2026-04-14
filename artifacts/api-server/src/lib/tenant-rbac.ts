import { requireTenantRole, type TenantRole } from "./auth";

export type OperationalFeature =
  | "fabric_rolls"
  | "production"
  | "dyeing"
  | "qc"
  | "warehouse"
  | "sales";

type AccessLevel = "read" | "write";

const OPERATIONAL_ROLE_MATRIX: Record<OperationalFeature, Record<AccessLevel, TenantRole[]>> = {
  fabric_rolls: {
    read: ["production_user", "dyeing_user", "qc_user", "warehouse_user", "sales_user"],
    write: ["production_user", "dyeing_user", "qc_user", "warehouse_user"],
  },
  production: {
    read: ["production_user"],
    write: ["production_user"],
  },
  dyeing: {
    read: ["dyeing_user"],
    write: ["dyeing_user"],
  },
  qc: {
    read: ["qc_user"],
    write: ["qc_user"],
  },
  warehouse: {
    read: ["warehouse_user"],
    write: ["warehouse_user"],
  },
  sales: {
    read: ["sales_user"],
    write: ["sales_user"],
  },
};

export function getOperationalRoles(feature: OperationalFeature, access: AccessLevel): TenantRole[] {
  return OPERATIONAL_ROLE_MATRIX[feature][access];
}

export function requireOperationalAccess(feature: OperationalFeature, access: AccessLevel) {
  return requireTenantRole(getOperationalRoles(feature, access));
}

export function getOperationalRoleMatrix() {
  return OPERATIONAL_ROLE_MATRIX;
}
