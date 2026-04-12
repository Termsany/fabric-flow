import { auditLogsTable, db, paymentMethodAuditLogsTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import type { Request } from "express";
import { getSuperAdminUser, isPlatformAdminRole, findPlatformAdminByEmail, isTenantRole } from "../lib/auth";

type AuditValueMap = Record<string, unknown>;

export function buildAuditChanges(input: {
  before?: AuditValueMap | null;
  after?: AuditValueMap | null;
  context?: AuditValueMap | null;
  reason?: string | null;
}) {
  return JSON.stringify({
    before: input.before ?? null,
    after: input.after ?? null,
    context: input.context ?? {},
    reason: input.reason ?? null,
  });
}

export function pickAuditFields<T extends object>(source: T, fields: Array<keyof T>) {
  return fields.reduce<AuditValueMap>((picked, field) => {
    picked[String(field)] = source[field] ?? null;
    return picked;
  }, {});
}

export async function writeOperationalAuditLog(input: {
  tenantId: number;
  userId: number | null;
  entityType: string;
  entityId: number;
  action: string;
  before?: AuditValueMap | null;
  after?: AuditValueMap | null;
  context?: AuditValueMap | null;
  reason?: string | null;
}) {
  await db.insert(auditLogsTable).values({
    tenantId: input.tenantId,
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    changes: buildAuditChanges(input),
  });
}

export async function writePaymentMethodAuditLog(input: {
  req: Request;
  paymentMethodCode: string;
  action: string;
  tenantId?: number | null;
  oldValues?: Record<string, unknown> | null;
  newValues?: Record<string, unknown> | null;
}) {
  const { req, paymentMethodCode, action, tenantId = null, oldValues = null, newValues = null } = input;
  const role = req.user?.role || "unknown";
  const actorUserId = !["super_admin", "support_admin", "billing_admin", "security_admin", "readonly_admin"].includes(role)
    ? req.user?.userId ?? null
    : null;
  const actorPlatformAdminId = ["support_admin", "billing_admin", "security_admin", "readonly_admin"].includes(role)
    ? req.user?.userId ?? null
    : null;
  let actorName = req.user?.email || "Unknown";

  if (isTenantRole(role) && actorUserId) {
    const [user] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, actorUserId));
    actorName = user?.fullName || actorName;
  } else if (role === "super_admin") {
    actorName = getSuperAdminUser()?.fullName || actorName;
  } else if (isPlatformAdminRole(role) && req.user?.email) {
    const admin = await findPlatformAdminByEmail(req.user.email);
    actorName = admin?.fullName || actorName;
  }

  await db.insert(paymentMethodAuditLogsTable).values({
    actorUserId,
    actorPlatformAdminId,
    actorName,
    actorRole: role,
    tenantId,
    paymentMethodCode,
    action,
    oldValues,
    newValues,
  });
}

export async function resolveUpdatedByName(updatedBy: number | null) {
  if (!updatedBy) return null;
  const [user] = await db.select({ fullName: usersTable.fullName }).from(usersTable).where(eq(usersTable.id, updatedBy));
  return user?.fullName ?? null;
}
