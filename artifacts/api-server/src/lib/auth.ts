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

export interface JwtPayload {
  userId: number;
  tenantId: number;
  role: string;
  email: string;
}

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
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  try {
    const payload = verifyToken(token);
    req.user = payload;
    next();
  } catch (err) {
    logger.warn({ err }, "Invalid JWT token");
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

  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Tenant admin access required" });
    return;
  }

  next();
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
