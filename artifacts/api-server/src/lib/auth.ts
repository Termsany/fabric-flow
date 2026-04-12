import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import type { Request, Response, NextFunction } from "express";
import { db, adminAuditLogsTable, platformAdminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";

const configuredJwtSecret = process.env.JWT_SECRET || process.env.SESSION_SECRET;

if (!configuredJwtSecret && process.env.NODE_ENV === "production") {
  throw new Error("JWT_SECRET or SESSION_SECRET must be set in production");
}

if (!configuredJwtSecret) {
  logger.warn("JWT secret is not configured; using an insecure development fallback secret");
}

const JWT_SECRET = configuredJwtSecret || "textile-erp-secret-key";
const JWT_EXPIRES_IN = "7d";
const JWT_ISSUER = process.env.JWT_ISSUER?.trim() || "fabric-flow";
const JWT_AUDIENCE = process.env.JWT_AUDIENCE?.trim() || undefined;
const JWT_CLOCK_TOLERANCE_SEC = Number(process.env.JWT_CLOCK_TOLERANCE_SEC || "15");
const AUTH_COOKIE_NAME = process.env.AUTH_COOKIE_NAME?.trim() || "textile_erp_session";
const AUTH_SESSION_MODE = (process.env.AUTH_SESSION_MODE?.trim().toLowerCase() || "bearer") as "bearer" | "cookie" | "hybrid";
const AUTH_COOKIE_SECURE = process.env.NODE_ENV === "production";
const AUTH_COOKIE_SAMESITE = (process.env.AUTH_COOKIE_SAMESITE?.trim().toLowerCase() || "lax") as "lax" | "strict" | "none";
const AUTH_COOKIE_DOMAIN = process.env.AUTH_COOKIE_DOMAIN?.trim() || undefined;
const AUTH_COOKIE_PATH = process.env.AUTH_COOKIE_PATH?.trim() || "/";
const AUTH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_TOKEN_LENGTH = 4096;

export interface JwtPayload {
  userId: number;
  tenantId: number;
  role: string;
  email: string;
}

export type TenantRole =
  | "tenant_admin"
  | "production_user"
  | "dyeing_user"
  | "qc_user"
  | "warehouse_user"
  | "sales_user";

export type PlatformAdminRole =
  | "super_admin"
  | "support_admin"
  | "billing_admin"
  | "security_admin"
  | "readonly_admin";

export type AdminPermission =
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

export interface SuperAdminIdentity {
  email: string;
  password: string;
  fullName: string;
}

const PLATFORM_ADMIN_ROLES = new Set<PlatformAdminRole>([
  "super_admin",
  "support_admin",
  "billing_admin",
  "security_admin",
  "readonly_admin",
]);

const TENANT_ROLES = new Set<TenantRole>([
  "tenant_admin",
  "production_user",
  "dyeing_user",
  "qc_user",
  "warehouse_user",
  "sales_user",
]);

const TENANT_ROLE_ALIASES: Record<string, TenantRole> = {
  admin: "tenant_admin",
  production: "production_user",
  dyeing: "dyeing_user",
  qc: "qc_user",
  warehouse: "warehouse_user",
  sales: "sales_user",
};

const ADMIN_PERMISSIONS: Record<PlatformAdminRole, AdminPermission[]> = {
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
  support_admin: ["tenants.read", "tenants.write", "tenants.impersonate", "tenant_payment_methods.view_any", "monitoring.read"],
  billing_admin: ["tenants.read", "billing.read", "payment_methods.view_global", "tenant_payment_methods.view_any"],
  security_admin: ["tenants.read", "tenant_payment_methods.view_any", "monitoring.read", "security.read"],
  readonly_admin: ["tenants.read", "billing.read", "payment_methods.view_global", "tenant_payment_methods.view_any", "monitoring.read"],
};

function getSuperAdminIdentity(): SuperAdminIdentity | null {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim();
  const password = process.env.SUPER_ADMIN_PASSWORD?.trim();
  const fullName = process.env.SUPER_ADMIN_NAME?.trim() || "Platform Super Admin";

  if (!email || !password) {
    return null;
  }

  return { email, password, fullName };
}

export function isSuperAdminConfigured(): boolean {
  return getSuperAdminIdentity() !== null;
}

export function getSuperAdminUser() {
  const identity = getSuperAdminIdentity();
  if (!identity) {
    return null;
  }

  return {
    id: 0,
    tenantId: 0,
    email: identity.email,
    fullName: identity.fullName,
    role: "super_admin",
    isActive: true,
  };
}

export async function verifySuperAdminCredentials(email: string, password: string): Promise<boolean> {
  const identity = getSuperAdminIdentity();
  if (!identity) {
    return false;
  }

  return identity.email === email && identity.password === password;
}

export function isPlatformAdminRole(role: string): role is PlatformAdminRole {
  return PLATFORM_ADMIN_ROLES.has(role as PlatformAdminRole);
}

export function normalizeTenantRole(role: string | null | undefined): TenantRole | null {
  if (!role) {
    return null;
  }
  if (TENANT_ROLES.has(role as TenantRole)) {
    return role as TenantRole;
  }
  return TENANT_ROLE_ALIASES[role] ?? null;
}

export function isTenantRole(role: string): boolean {
  return normalizeTenantRole(role) !== null;
}

export function hasAdminPermission(role: string, permission: AdminPermission): boolean {
  if (!isPlatformAdminRole(role)) {
    return false;
  }

  return ADMIN_PERMISSIONS[role].includes(permission);
}

export async function findPlatformAdminByEmail(email: string) {
  const [admin] = await db.select().from(platformAdminsTable).where(eq(platformAdminsTable.email, email));
  return admin ?? null;
}

export async function verifyPlatformAdminCredentials(email: string, password: string) {
  const admin = await findPlatformAdminByEmail(email);
  if (!admin || !admin.isActive) {
    return null;
  }

  const valid = await comparePassword(password, admin.passwordHash);
  if (!valid || !isPlatformAdminRole(admin.role)) {
    return null;
  }

  return admin;
}

export function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    algorithm: "HS256",
    issuer: JWT_ISSUER,
    ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
  });
}

export function verifyToken(token: string): JwtPayload {
  const decoded = jwt.verify(token, JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: JWT_ISSUER,
    clockTolerance: Number.isFinite(JWT_CLOCK_TOLERANCE_SEC) ? JWT_CLOCK_TOLERANCE_SEC : 15,
    ...(JWT_AUDIENCE ? { audience: JWT_AUDIENCE } : {}),
  });

  if (!decoded || typeof decoded !== "object") {
    throw new Error("Invalid token payload");
  }

  const payload = decoded as Partial<JwtPayload>;
  if (
    typeof payload.userId !== "number"
    || typeof payload.tenantId !== "number"
    || typeof payload.role !== "string"
    || typeof payload.email !== "string"
    || payload.role.trim().length === 0
    || payload.email.trim().length === 0
  ) {
    throw new Error("Invalid token payload");
  }

  return {
    userId: payload.userId,
    tenantId: payload.tenantId,
    role: payload.role,
    email: payload.email,
  };
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

function parseCookies(header: string | undefined): Record<string, string> {
  if (!header) {
    return {};
  }

  return header.split(";").reduce<Record<string, string>>((acc, entry) => {
    const separatorIndex = entry.indexOf("=");
    if (separatorIndex === -1) {
      return acc;
    }

    const key = entry.slice(0, separatorIndex).trim();
    const value = entry.slice(separatorIndex + 1).trim();
    if (!key) {
      return acc;
    }

    acc[key] = decodeURIComponent(value);
    return acc;
  }, {});
}

export function getAuthCookieName(): string {
  return AUTH_COOKIE_NAME;
}

export function getAuthSessionMode(): "bearer" | "cookie" | "hybrid" {
  return AUTH_SESSION_MODE;
}

export function shouldUseCookieSessions(): boolean {
  return AUTH_SESSION_MODE === "cookie" || AUTH_SESSION_MODE === "hybrid";
}

if (process.env.NODE_ENV === "production" && shouldUseCookieSessions()) {
  if (AUTH_COOKIE_SAMESITE === "none" && !AUTH_COOKIE_SECURE) {
    logger.warn("AUTH_COOKIE_SAMESITE=none requires HTTPS cookies; ensure TLS is enabled.");
  }
}

export function getRequestAuthToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    return token.length > 0 && token.length <= MAX_TOKEN_LENGTH ? token : null;
  }

  if (!shouldUseCookieSessions()) {
    return null;
  }

  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[AUTH_COOKIE_NAME];
  return token && token.length <= MAX_TOKEN_LENGTH ? token : null;
}

export function attachSessionCookie(res: Response, token: string): void {
  if (!shouldUseCookieSessions()) {
    return;
  }

  res.cookie(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: AUTH_COOKIE_SAMESITE,
    secure: AUTH_COOKIE_SECURE,
    domain: AUTH_COOKIE_DOMAIN,
    path: AUTH_COOKIE_PATH,
    maxAge: AUTH_COOKIE_MAX_AGE_MS,
  });
}

export function clearSessionCookie(res: Response): void {
  if (!shouldUseCookieSessions()) {
    return;
  }

  res.clearCookie(AUTH_COOKIE_NAME, {
    httpOnly: true,
    sameSite: AUTH_COOKIE_SAMESITE,
    secure: AUTH_COOKIE_SECURE,
    domain: AUTH_COOKIE_DOMAIN,
    path: AUTH_COOKIE_PATH,
  });
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = getRequestAuthToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    logger.warn(
      {
        err,
        reqId: req.id,
        path: req.path,
        ip: req.ip,
      },
      "Invalid JWT token",
    );
    clearSessionCookie(res);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}

export function requireTenantAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (!isTenantAdminRole(req.user.role)) {
    res.status(403).json({ error: "Tenant admin access required" });
    return;
  }

  next();
}

export function isTenantAdminRole(role: string): boolean {
  return normalizeTenantRole(role) === "tenant_admin";
}

export function isSuperAdminRole(role: string): boolean {
  return role === "super_admin";
}

export function requireTenantRole(roles: TenantRole[], options?: { allowTenantAdmin?: boolean }) {
  const allowed = new Set<TenantRole>(roles);
  if (options?.allowTenantAdmin !== false) {
    allowed.add("tenant_admin");
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const normalizedRole = normalizeTenantRole(req.user.role);
    if (!normalizedRole || !allowed.has(normalizedRole)) {
      res.status(403).json({ error: "Tenant role access required" });
      return;
    }

    next();
  };
}

export function requireSuperAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (req.user.role !== "super_admin") {
    res.status(403).json({ error: "Super admin access required" });
    return;
  }

  next();
}

export function requireAdminPermission(permission: AdminPermission) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    if (!hasAdminPermission(req.user.role, permission)) {
      res.status(403).json({ error: "Admin permission required" });
      return;
    }

    next();
  };
}

interface AdminAuditInput {
  req: Request;
  action: string;
  entityType: string;
  entityId?: string | number | null;
  targetTenantId?: number | null;
  severity?: "info" | "warning" | "high";
  metadata?: unknown;
}

export async function writeAdminAuditLog({
  req,
  action,
  entityType,
  entityId,
  targetTenantId,
  severity = "info",
  metadata,
}: AdminAuditInput): Promise<void> {
  if (!req.user || !isPlatformAdminRole(req.user.role)) {
    return;
  }

  try {
    await db.insert(adminAuditLogsTable).values({
      platformAdminId: req.user.userId > 0 ? req.user.userId : null,
      adminEmail: req.user.email,
      adminRole: req.user.role,
      action,
      entityType,
      entityId: entityId != null ? String(entityId) : null,
      targetTenantId: targetTenantId ?? null,
      severity,
      metadata: metadata == null ? null : JSON.stringify(metadata),
    });
  } catch (err) {
    logger.error({ err, action, entityType }, "Failed to write admin audit log");
  }
}
