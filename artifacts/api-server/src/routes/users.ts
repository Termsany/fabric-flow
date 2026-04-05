import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { hashPassword } from "../lib/auth";
import { writeAdminAuditLog } from "../lib/auth";
import { z } from "zod";
import { checkSubscription, ensureUsageWithinLimit } from "../lib/billing";
import {
  ListUsersResponse,
  CreateUserBody,
  GetUserParams,
  GetUserResponse,
  UpdateUserParams,
  UpdateUserBody,
  UpdateUserResponse,
  DeleteUserParams,
} from "@workspace/api-zod";

const router = Router();
const resetPasswordSchema = z.object({
  newPassword: z.string().min(8),
});

function isStrongPassword(password: string): boolean {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password);
}

router.get("/users", requireAuth, async (req, res): Promise<void> => {
  const users = await db.select().from(usersTable).where(eq(usersTable.tenantId, req.user!.tenantId));
  res.json(ListUsersResponse.parse(users.map(u => ({
    id: u.id,
    tenantId: u.tenantId,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    isActive: u.isActive,
    createdAt: u.createdAt.toISOString(),
    updatedAt: u.updatedAt.toISOString(),
  }))));
});

router.post("/users", requireAuth, checkSubscription(), async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, parsed.data.email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const usageCheck = await ensureUsageWithinLimit(req.user!.tenantId, "users");
  if (!usageCheck.allowed) {
    res.status(403).json({
      error: "User limit reached for current subscription plan",
      current: usageCheck.current,
      limit: usageCheck.limit,
    });
    return;
  }

  const { email, password, fullName, role } = parsed.data;
  const passwordHash = await hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    tenantId: req.user!.tenantId,
    email,
    passwordHash,
    fullName,
    role,
    isActive: true,
  }).returning();

  res.status(201).json({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
});

router.get("/users/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(
    and(eq(usersTable.id, params.data.id), eq(usersTable.tenantId, req.user!.tenantId))
  );

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(GetUserResponse.parse({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));
});

router.patch("/users/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const params = UpdateUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const updates: Record<string, unknown> = {};
  if (parsed.data.fullName != null) updates.fullName = parsed.data.fullName;
  if (parsed.data.role != null) updates.role = parsed.data.role;
  if (parsed.data.isActive != null) updates.isActive = parsed.data.isActive;
  if (parsed.data.password) updates.passwordHash = await hashPassword(parsed.data.password);

  const [user] = await db.update(usersTable).set(updates).where(
    and(eq(usersTable.id, params.data.id), eq(usersTable.tenantId, req.user!.tenantId))
  ).returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json(UpdateUserResponse.parse({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  }));
});

router.delete("/users/:id", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const params = DeleteUserParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: "Invalid ID" });
    return;
  }

  if (params.data.id === req.user!.userId) {
    res.status(400).json({ error: "You cannot delete your own account" });
    return;
  }

  await db.delete(usersTable).where(
    and(eq(usersTable.id, params.data.id), eq(usersTable.tenantId, req.user!.tenantId))
  );

  res.sendStatus(204);
});

router.patch("/admin/users/:id/password", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const userId = Number(req.params.id);
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!Number.isInteger(userId) || userId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (!isStrongPassword(parsed.data.newPassword)) {
    res.status(400).json({ error: "Password must be at least 8 characters and include upper, lower, and number" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const [user] = await db.update(usersTable)
    .set({
      passwordHash,
      passwordUpdatedAt: new Date(),
    })
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, req.user!.tenantId)))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ success: true, id: user.id });
});

router.patch("/admin/tenants/:tenantId/users/:id/password", requireAuth, async (req, res): Promise<void> => {
  if (req.user!.role !== "super_admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const tenantId = Number(req.params.tenantId);
  const userId = Number(req.params.id);
  const parsed = resetPasswordSchema.safeParse(req.body);
  if (!Number.isInteger(tenantId) || tenantId <= 0 || !Number.isInteger(userId) || userId <= 0 || !parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (!isStrongPassword(parsed.data.newPassword)) {
    res.status(400).json({ error: "Password must be at least 8 characters and include upper, lower, and number" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  const [user] = await db.update(usersTable)
    .set({
      passwordHash,
      passwordUpdatedAt: new Date(),
    })
    .where(and(eq(usersTable.id, userId), eq(usersTable.tenantId, tenantId)))
    .returning();

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await writeAdminAuditLog({
    req,
    action: "TENANT_USER_PASSWORD_RESET",
    entityType: "user",
    entityId: user.id,
    targetTenantId: tenantId,
    severity: "warning",
    metadata: {
      userEmail: user.email,
      userRole: user.role,
    },
  });

  res.json({ success: true, id: user.id });
});

export default router;
