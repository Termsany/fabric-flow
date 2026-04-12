const PLATFORM_ADMIN_ROLES = [
  "super_admin",
  "support_admin",
  "billing_admin",
  "security_admin",
  "readonly_admin",
] as const;

export const TENANT_ROLES = [
  "tenant_admin",
  "production_user",
  "dyeing_user",
  "qc_user",
  "warehouse_user",
  "sales_user",
] as const;

export type TenantRole = (typeof TENANT_ROLES)[number];

export type PlatformAdminPermission =
  | "tenants.read"
  | "tenants.write"
  | "tenants.impersonate"
  | "billing.read"
  | "billing.write"
  | "payment_methods.view_global"
  | "payment_methods.manage_global"
  | "tenant_payment_methods.view_any"
  | "tenant_payment_methods.manage_any"
  | "monitoring.read"
  | "security.read";

const PLATFORM_ADMIN_PERMISSIONS: Record<(typeof PLATFORM_ADMIN_ROLES)[number], readonly PlatformAdminPermission[]> = {
  super_admin: [
    "tenants.read",
    "tenants.write",
    "tenants.impersonate",
    "billing.read",
    "billing.write",
    "payment_methods.view_global",
    "payment_methods.manage_global",
    "tenant_payment_methods.view_any",
    "tenant_payment_methods.manage_any",
    "monitoring.read",
    "security.read",
  ],
  support_admin: [
    "tenants.read",
    "tenants.write",
    "tenants.impersonate",
    "tenant_payment_methods.view_any",
    "monitoring.read",
  ],
  billing_admin: [
    "tenants.read",
    "billing.read",
    "payment_methods.view_global",
    "tenant_payment_methods.view_any",
  ],
  security_admin: [
    "tenants.read",
    "tenant_payment_methods.view_any",
    "monitoring.read",
    "security.read",
  ],
  readonly_admin: [
    "tenants.read",
    "billing.read",
    "payment_methods.view_global",
    "tenant_payment_methods.view_any",
    "monitoring.read",
  ],
} as const;

export function isPlatformAdminRole(role?: string | null): boolean {
  return PLATFORM_ADMIN_ROLES.includes((role ?? "") as (typeof PLATFORM_ADMIN_ROLES)[number]);
}

const TENANT_ROLE_ALIASES: Record<string, TenantRole> = {
  admin: "tenant_admin",
  production: "production_user",
  dyeing: "dyeing_user",
  qc: "qc_user",
  warehouse: "warehouse_user",
  sales: "sales_user",
};

export function normalizeTenantRole(role?: string | null): TenantRole | null {
  if (!role) return null;
  if (TENANT_ROLES.includes(role as TenantRole)) return role as TenantRole;
  return TENANT_ROLE_ALIASES[role] ?? null;
}

export function isTenantAdminRole(role?: string | null): boolean {
  return normalizeTenantRole(role) === "tenant_admin";
}

export function isTenantRole(role?: string | null): boolean {
  return normalizeTenantRole(role) !== null;
}

export function hasPlatformAdminPermission(
  role: string | null | undefined,
  permission: PlatformAdminPermission,
): boolean {
  if (!isPlatformAdminRole(role)) {
    return false;
  }

  const adminRole = role as keyof typeof PLATFORM_ADMIN_PERMISSIONS;
  return PLATFORM_ADMIN_PERMISSIONS[adminRole].includes(permission);
}

export function getHomeRouteForRole(role?: string | null): string {
  if (role === "billing_admin") return "/admin/billing";
  if (role === "security_admin") return "/admin/monitoring";
  if (isPlatformAdminRole(role)) return "/admin/tenants";
  if (isTenantRole(role)) return "/dashboard";
  return "/dashboard";
}

export function isRoleAllowed(allowedRoles: string[] | undefined, role?: string | null): boolean {
  if (!allowedRoles) return true;
  const normalized = normalizeTenantRole(role);
  if (role && allowedRoles.includes(role)) return true;
  if (normalized && allowedRoles.includes(normalized)) return true;
  return false;
}

export function hasTenantFeatureAccess(role: string | null | undefined, feature: "dashboard" | "fabric_rolls" | "production" | "dyeing" | "qc" | "warehouse" | "sales" | "users" | "billing" | "audit") {
  const normalized = normalizeTenantRole(role);
  if (!normalized) return false;
  if (normalized === "tenant_admin") return true;
  if (feature === "dashboard") return true;
  if (feature === "fabric_rolls") {
    return ["production_user", "qc_user", "dyeing_user", "warehouse_user", "sales_user"].includes(normalized);
  }
  if (feature === "production") return normalized === "production_user";
  if (feature === "dyeing") return normalized === "dyeing_user";
  if (feature === "qc") return normalized === "qc_user";
  if (feature === "warehouse") return normalized === "warehouse_user";
  if (feature === "sales") return normalized === "sales_user";
  if (feature === "users" || feature === "billing" || feature === "audit") return normalized === "tenant_admin";
  return false;
}
