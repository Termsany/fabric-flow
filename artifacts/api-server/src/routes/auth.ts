import { Router } from "express";
import { db, usersTable, tenantsTable, platformAdminsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  signToken,
  hashPassword,
  comparePassword,
  requireAuth,
  getSuperAdminUser,
  verifySuperAdminCredentials,
  verifyPlatformAdminCredentials,
  isPlatformAdminRole,
} from "../lib/auth";
import { LoginBody, RegisterBody, GetMeResponse } from "@workspace/api-zod";
import { paymentMethodsService } from "../modules/payment-methods/payment-methods.service";
import { plansService } from "../modules/plans/plans.service";

const router = Router();
const changePasswordAttempts = new Map<string, { count: number; resetAt: number }>();
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
const CHANGE_PASSWORD_MAX_ATTEMPTS = 6;

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

function isStrongPassword(password: string): boolean {
  return password.length >= 8
    && /[A-Z]/.test(password)
    && /[a-z]/.test(password)
    && /\d/.test(password);
}

function checkRateLimit(key: string) {
  const now = Date.now();
  const entry = changePasswordAttempts.get(key);
  if (!entry || entry.resetAt <= now) {
    changePasswordAttempts.set(key, { count: 1, resetAt: now + CHANGE_PASSWORD_WINDOW_MS });
    return { limited: false };
  }

  if (entry.count >= CHANGE_PASSWORD_MAX_ATTEMPTS) {
    return { limited: true, retryAfterMs: entry.resetAt - now };
  }

  entry.count += 1;
  return { limited: false };
}

function clearRateLimit(key: string) {
  changePasswordAttempts.delete(key);
}

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password } = parsed.data;
  const platformAdmin = await verifyPlatformAdminCredentials(email, password);
  if (platformAdmin) {
    await db.update(platformAdminsTable)
      .set({ lastLoginAt: new Date() })
      .where(eq(platformAdminsTable.id, platformAdmin.id));

    const token = signToken({
      userId: platformAdmin.id,
      tenantId: 0,
      role: platformAdmin.role,
      email: platformAdmin.email,
    });

    res.json({
      token,
      user: {
        id: platformAdmin.id,
        tenantId: 0,
        email: platformAdmin.email,
        fullName: platformAdmin.fullName,
        role: platformAdmin.role,
        isActive: platformAdmin.isActive,
        createdAt: platformAdmin.createdAt.toISOString(),
        updatedAt: platformAdmin.updatedAt.toISOString(),
      },
    });
    return;
  }

  const superAdmin = getSuperAdminUser();
  if (superAdmin) {
    const validSuperAdmin = await verifySuperAdminCredentials(email, password);
    if (validSuperAdmin) {
      const token = signToken({
        userId: superAdmin.id,
        tenantId: superAdmin.tenantId,
        role: superAdmin.role,
        email: superAdmin.email,
      });

      res.json({
        token,
        user: {
          ...superAdmin,
          createdAt: new Date(0).toISOString(),
          updatedAt: new Date(0).toISOString(),
        },
      });
      return;
    }
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));

  if (!user || !user.isActive) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  await db.update(usersTable)
    .set({ lastLoginAt: new Date() })
    .where(eq(usersTable.id, user.id));

  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email });

  res.json({
    token,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
});

router.post("/auth/register", async (req, res): Promise<void> => {
  const parsed = RegisterBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { companyName, email, password, fullName } = parsed.data;
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + 14);

  const [existing] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing) {
    res.status(400).json({ error: "Email already registered" });
    return;
  }

  const [tenant] = await db.insert(tenantsTable).values({
    name: companyName,
    currentPlan: "basic",
    billingStatus: "trialing",
    trialEndsAt,
    subscriptionEndsAt: trialEndsAt,
  }).returning();
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    tenantId: tenant.id,
    email,
    passwordHash,
    fullName,
    role: "admin",
    isActive: true,
  }).returning();

  await paymentMethodsService.initializeTenantPaymentMethods(tenant.id);
  await plansService.ensureTenantSubscription(tenant.id);

  const token = signToken({ userId: user.id, tenantId: user.tenantId, role: user.role, email: user.email });

  res.status(201).json({
    token,
    user: {
      id: user.id,
      tenantId: user.tenantId,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
});

router.get("/auth/me", requireAuth, async (req, res): Promise<void> => {
  if (isPlatformAdminRole(req.user!.role) && req.user!.userId > 0) {
    const [admin] = await db.select().from(platformAdminsTable).where(eq(platformAdminsTable.id, req.user!.userId));
    if (!admin || !admin.isActive) {
      res.status(401).json({ error: "Admin not found" });
      return;
    }

    res.json(GetMeResponse.parse({
      id: admin.id,
      tenantId: 0,
      email: admin.email,
      fullName: admin.fullName,
      role: admin.role,
      isActive: admin.isActive,
      createdAt: admin.createdAt.toISOString(),
      updatedAt: admin.updatedAt.toISOString(),
    }));
    return;
  }

  if (req.user!.role === "super_admin") {
    const superAdmin = getSuperAdminUser();
    if (!superAdmin) {
      res.status(401).json({ error: "Super admin is not configured" });
      return;
    }

    res.json(GetMeResponse.parse({
      ...superAdmin,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    }));
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  res.json(GetMeResponse.parse({
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

router.post("/auth/change-password", requireAuth, async (req, res): Promise<void> => {
  const rateKey = `${req.user!.userId}:${req.ip}`;
  const rateLimit = checkRateLimit(rateKey);
  if (rateLimit.limited) {
    res.status(429).json({ error: "Too many attempts. Please try again later." });
    return;
  }

  const parsed = changePasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid password input" });
    return;
  }

  if (!isStrongPassword(parsed.data.newPassword)) {
    res.status(400).json({ error: "Password must be at least 8 characters and include upper, lower, and number" });
    return;
  }

  if (isPlatformAdminRole(req.user!.role) || req.user!.role === "super_admin") {
    let platformAdmin = req.user!.userId > 0
      ? (await db.select().from(platformAdminsTable).where(eq(platformAdminsTable.id, req.user!.userId)))[0] ?? null
      : null;

    if (platformAdmin) {
      const valid = await comparePassword(parsed.data.currentPassword, platformAdmin.passwordHash);
      if (!valid) {
        res.status(400).json({ error: "Current password is incorrect" });
        return;
      }

      const passwordHash = await hashPassword(parsed.data.newPassword);
      await db.update(platformAdminsTable)
        .set({
          passwordHash,
          updatedAt: new Date(),
        })
        .where(eq(platformAdminsTable.id, platformAdmin.id));

      clearRateLimit(rateKey);
      res.json({ success: true });
      return;
    }

    if (req.user!.role !== "super_admin" || req.user!.userId !== 0) {
      res.status(404).json({ error: "Admin not found" });
      return;
    }

    const superAdmin = getSuperAdminUser();
    if (!superAdmin) {
      res.status(401).json({ error: "Super admin is not configured" });
      return;
    }

    const valid = await verifySuperAdminCredentials(req.user!.email, parsed.data.currentPassword);
    if (!valid) {
      res.status(400).json({ error: "Current password is incorrect" });
      return;
    }

    const passwordHash = await hashPassword(parsed.data.newPassword);
    platformAdmin = (await db.insert(platformAdminsTable).values({
      email: superAdmin.email,
      passwordHash,
      fullName: superAdmin.fullName,
      role: "super_admin",
      isActive: true,
    }).onConflictDoUpdate({
      target: platformAdminsTable.email,
      set: {
        passwordHash,
        fullName: superAdmin.fullName,
        role: "super_admin",
        isActive: true,
        updatedAt: new Date(),
      },
    }).returning())[0] ?? null;

    clearRateLimit(rateKey);
    res.json({ success: true, migrated: Boolean(platformAdmin) });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.user!.userId));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  const valid = await comparePassword(parsed.data.currentPassword, user.passwordHash);
  if (!valid) {
    res.status(400).json({ error: "Current password is incorrect" });
    return;
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await db.update(usersTable)
    .set({
      passwordHash,
      passwordUpdatedAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  clearRateLimit(rateKey);
  res.json({ success: true });
});

export default router;
