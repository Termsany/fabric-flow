import {
  clearRateLimit,
  checkRateLimit,
  isStrongPassword,
} from "./auth.support";
import {
  buildTenantAdminValues,
  buildTenantRegistrationValues,
  buildTrialWindow,
} from "./auth.logic";
import {
  formatCurrentAppUser,
  formatCurrentPlatformAdmin,
  formatCurrentSuperAdmin,
  formatEnvSuperAdminAuthResponse,
  formatUserAuthResponse,
} from "./auth.mappers";
import { authRepository } from "./auth.repository";
import {
  comparePassword,
  getSuperAdminUser,
  hashPassword,
  isPlatformAdminRole,
  signToken,
  verifyPlatformAdminCredentials,
  verifySuperAdminCredentials,
  type JwtPayload,
} from "../../lib/auth";
import { paymentMethodsService } from "../payment-methods/payment-methods.service";
import { plansService } from "../plans/plans.service";

export type AuthServiceDependencies = {
  authRepository: {
    findUserByEmail: (email: string) => Promise<Array<{
      id: number;
      tenantId: number;
      email: string;
      passwordHash: string;
      fullName: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>;
    findUserById: (id: number) => Promise<Array<{
      id: number;
      tenantId: number;
      email: string;
      passwordHash: string;
      fullName: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>;
    updateUserLastLogin: (id: number) => Promise<unknown>;
    updateUserPassword: (id: number, passwordHash: string) => Promise<unknown>;
    createTenant: (values: {
      name: string;
      currentPlan: string;
      billingStatus: string;
      trialEndsAt: Date;
      subscriptionEndsAt: Date;
    }) => Promise<Array<{ id: number }>>;
    createUser: (values: {
      tenantId: number;
      email: string;
      passwordHash: string;
      fullName: string;
      role: string;
      isActive: boolean;
    }) => Promise<Array<{
      id: number;
      tenantId: number;
      email: string;
      fullName: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>;
    findPlatformAdminById: (id: number) => Promise<Array<{
      id: number;
      email: string;
      passwordHash: string;
      fullName: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>;
    updatePlatformAdminLastLogin: (id: number) => Promise<unknown>;
    updatePlatformAdminPassword: (id: number, passwordHash: string) => Promise<unknown>;
    upsertSuperAdminPlatformAccount: (values: {
      email: string;
      passwordHash: string;
      fullName: string;
    }) => Promise<Array<{
      id: number;
      email: string;
      passwordHash: string;
      fullName: string;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    }>>;
  };
  verifyPlatformAdminCredentials: typeof verifyPlatformAdminCredentials;
  getSuperAdminUser: typeof getSuperAdminUser;
  verifySuperAdminCredentials: typeof verifySuperAdminCredentials;
  comparePassword: typeof comparePassword;
  hashPassword: typeof hashPassword;
  signToken: typeof signToken;
  paymentMethodsService: {
    initializeTenantPaymentMethods: (tenantId: number) => Promise<unknown>;
  };
  plansService: {
    ensureTenantSubscription: (tenantId: number) => Promise<unknown>;
  };
  checkRateLimit: typeof checkRateLimit;
  clearRateLimit: typeof clearRateLimit;
  isStrongPassword: typeof isStrongPassword;
  isPlatformAdminRole: (role: string) => boolean;
};

export function createAuthService(
  deps: AuthServiceDependencies = {
    authRepository,
    verifyPlatformAdminCredentials,
    getSuperAdminUser,
    verifySuperAdminCredentials,
    comparePassword,
    hashPassword,
    signToken,
    paymentMethodsService,
    plansService,
    checkRateLimit,
    clearRateLimit,
    isStrongPassword,
    isPlatformAdminRole,
  },
) {
  const {
    authRepository,
    verifyPlatformAdminCredentials,
    getSuperAdminUser,
    verifySuperAdminCredentials,
    comparePassword,
    hashPassword,
    signToken,
    paymentMethodsService,
    plansService,
    checkRateLimit,
    clearRateLimit,
    isStrongPassword,
    isPlatformAdminRole,
  } = deps;

  return {
  async login(email: string, password: string) {
    const platformAdmin = await verifyPlatformAdminCredentials(email, password);
    if (platformAdmin) {
      await authRepository.updatePlatformAdminLastLogin(platformAdmin.id);
      return formatUserAuthResponse({
        id: platformAdmin.id,
        tenantId: 0,
        email: platformAdmin.email,
        fullName: platformAdmin.fullName,
        role: platformAdmin.role,
        isActive: platformAdmin.isActive,
        createdAt: platformAdmin.createdAt,
        updatedAt: platformAdmin.updatedAt,
      }, signToken);
    }

    const superAdmin = getSuperAdminUser();
    if (superAdmin && await verifySuperAdminCredentials(email, password)) {
      return formatEnvSuperAdminAuthResponse(superAdmin, signToken);
    }

    const [user] = await authRepository.findUserByEmail(email);
    if (!user || !user.isActive) {
      return null;
    }

    const valid = await comparePassword(password, user.passwordHash);
    if (!valid) {
      return null;
    }

    await authRepository.updateUserLastLogin(user.id);
    return formatUserAuthResponse(user, signToken);
  },

  async register(input: {
    companyName: string;
    email: string;
    password: string;
    fullName: string;
  }) {
    const [existing] = await authRepository.findUserByEmail(input.email);
    if (existing) {
      return { error: "Email already registered" as const };
    }

    const trialWindow = buildTrialWindow();

    const [tenant] = await authRepository.createTenant(
      buildTenantRegistrationValues(input.companyName, trialWindow),
    );

    const passwordHash = await hashPassword(input.password);
    const [user] = await authRepository.createUser(
      buildTenantAdminValues({
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
      }),
    );

    await paymentMethodsService.initializeTenantPaymentMethods(tenant.id);
    await plansService.ensureTenantSubscription(tenant.id);

    return { data: formatUserAuthResponse(user, signToken) };
  },

  async getCurrentUser(user: JwtPayload) {
    if (isPlatformAdminRole(user.role) && user.userId > 0) {
      const [admin] = await authRepository.findPlatformAdminById(user.userId);
      if (!admin || !admin.isActive) {
        return { error: "Admin not found" as const };
      }

      return {
        data: formatCurrentPlatformAdmin(admin),
      };
    }

    if (user.role === "super_admin") {
      const superAdmin = getSuperAdminUser();
      if (!superAdmin) {
        return { error: "Super admin is not configured" as const };
      }

      return {
        data: formatCurrentSuperAdmin(superAdmin),
      };
    }

    const [appUser] = await authRepository.findUserById(user.userId);
    if (!appUser) {
      return { error: "User not found" as const };
    }

    return {
      data: formatCurrentAppUser(appUser),
    };
  },

  async changePassword(user: JwtPayload, reqMeta: { ip: string | undefined }, input: { currentPassword: string; newPassword: string }) {
    const rateKey = `${user.userId}:${reqMeta.ip ?? "unknown"}`;
    const rateLimit = checkRateLimit(rateKey);
    if (rateLimit.limited) {
      return { status: 429 as const, error: "Too many attempts. Please try again later." };
    }

    if (!isStrongPassword(input.newPassword)) {
      return { status: 400 as const, error: "Password must be at least 8 characters and include upper, lower, and number" };
    }

    if (isPlatformAdminRole(user.role) || user.role === "super_admin") {
      let platformAdmin = user.userId > 0
        ? ((await authRepository.findPlatformAdminById(user.userId))[0] ?? null)
        : null;

      if (platformAdmin) {
        const valid = await comparePassword(input.currentPassword, platformAdmin.passwordHash);
        if (!valid) {
          return { status: 400 as const, error: "Current password is incorrect" };
        }

        const passwordHash = await hashPassword(input.newPassword);
        await authRepository.updatePlatformAdminPassword(platformAdmin.id, passwordHash);
        clearRateLimit(rateKey);
        return { status: 200 as const, data: { success: true } };
      }

      if (user.role !== "super_admin" || user.userId !== 0) {
        return { status: 404 as const, error: "Admin not found" };
      }

      const superAdmin = getSuperAdminUser();
      if (!superAdmin) {
        return { status: 401 as const, error: "Super admin is not configured" };
      }

      const valid = await verifySuperAdminCredentials(user.email, input.currentPassword);
      if (!valid) {
        return { status: 400 as const, error: "Current password is incorrect" };
      }

      const passwordHash = await hashPassword(input.newPassword);
      platformAdmin = (await authRepository.upsertSuperAdminPlatformAccount({
        email: superAdmin.email,
        passwordHash,
        fullName: superAdmin.fullName,
      }))[0] ?? null;

      clearRateLimit(rateKey);
      return { status: 200 as const, data: { success: true, migrated: Boolean(platformAdmin) } };
    }

    const [appUser] = await authRepository.findUserById(user.userId);
    if (!appUser) {
      return { status: 404 as const, error: "User not found" };
    }

    const valid = await comparePassword(input.currentPassword, appUser.passwordHash);
    if (!valid) {
      return { status: 400 as const, error: "Current password is incorrect" };
    }

    const passwordHash = await hashPassword(input.newPassword);
    await authRepository.updateUserPassword(appUser.id, passwordHash);
    clearRateLimit(rateKey);
    return { status: 200 as const, data: { success: true } };
  },
  };
}

export const authService = createAuthService();
