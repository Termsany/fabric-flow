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

type AuthSuccessResult<T> = {
  ok: true;
  status: number;
  data: T;
};

type AuthFailureResult = {
  ok: false;
  status: number;
  error: string;
};

export type AuthServiceResult<T> = AuthSuccessResult<T> | AuthFailureResult;

function successResult<T>(data: T, status = 200): AuthSuccessResult<T> {
  return { ok: true, status, data };
}

function failureResult(status: number, error: string): AuthFailureResult {
  return { ok: false, status, error };
}

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

  async function tryLoginPlatformAdmin(email: string, password: string) {
    const platformAdmin = await verifyPlatformAdminCredentials(email, password);
    if (!platformAdmin) {
      return null;
    }

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

  async function tryLoginSuperAdmin(email: string, password: string) {
    const superAdmin = getSuperAdminUser();
    if (!superAdmin) {
      return null;
    }

    const isValid = await verifySuperAdminCredentials(email, password);
    if (!isValid) {
      return null;
    }

    return formatEnvSuperAdminAuthResponse(superAdmin, signToken);
  }

  async function tryLoginAppUser(email: string, password: string) {
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
  }

  async function changePlatformAdminPassword(
    platformAdmin: {
      id: number;
      passwordHash: string;
    },
    input: { currentPassword: string; newPassword: string },
    rateKey: string,
  ) {
    const valid = await comparePassword(input.currentPassword, platformAdmin.passwordHash);
    if (!valid) {
      return failureResult(400, "Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.newPassword);
    await authRepository.updatePlatformAdminPassword(platformAdmin.id, passwordHash);
    clearRateLimit(rateKey);
    return successResult({ success: true as const });
  }

  async function changeSuperAdminPassword(
    user: JwtPayload,
    input: { currentPassword: string; newPassword: string },
    rateKey: string,
  ) {
    if (user.role !== "super_admin" || user.userId !== 0) {
      return failureResult(404, "Admin not found");
    }

    const superAdmin = getSuperAdminUser();
    if (!superAdmin) {
      return failureResult(401, "Super admin is not configured");
    }

    const valid = await verifySuperAdminCredentials(user.email, input.currentPassword);
    if (!valid) {
      return failureResult(400, "Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.newPassword);
    const platformAdmin = (await authRepository.upsertSuperAdminPlatformAccount({
      email: superAdmin.email,
      passwordHash,
      fullName: superAdmin.fullName,
    }))[0] ?? null;

    clearRateLimit(rateKey);
    return successResult({ success: true as const, migrated: Boolean(platformAdmin) });
  }

  async function changeAppUserPassword(
    user: JwtPayload,
    input: { currentPassword: string; newPassword: string },
    rateKey: string,
  ) {
    const [appUser] = await authRepository.findUserById(user.userId);
    if (!appUser) {
      return failureResult(404, "User not found");
    }

    const valid = await comparePassword(input.currentPassword, appUser.passwordHash);
    if (!valid) {
      return failureResult(400, "Current password is incorrect");
    }

    const passwordHash = await hashPassword(input.newPassword);
    await authRepository.updateUserPassword(appUser.id, passwordHash);
    clearRateLimit(rateKey);
    return successResult({ success: true as const });
  }

  async function ensureRegistrationEmailAvailable(email: string) {
    const [existing] = await authRepository.findUserByEmail(email);
    if (existing) {
      return failureResult(400, "Email already registered");
    }

    return null;
  }

  async function createTenantAndAdminUser(input: {
    companyName: string;
    email: string;
    password: string;
    fullName: string;
  }) {
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

    return { tenant, user };
  }

  async function provisionRegisteredTenant(tenantId: number) {
    await paymentMethodsService.initializeTenantPaymentMethods(tenantId);
    await plansService.ensureTenantSubscription(tenantId);
  }

  return {
  async login(email: string, password: string) {
    const platformAdminResult = await tryLoginPlatformAdmin(email, password);
    if (platformAdminResult) {
      return successResult(platformAdminResult);
    }

    const superAdminResult = await tryLoginSuperAdmin(email, password);
    if (superAdminResult) {
      return successResult(superAdminResult);
    }

    const appUserResult = await tryLoginAppUser(email, password);
    if (appUserResult) {
      return successResult(appUserResult);
    }

    return failureResult(401, "Invalid credentials");
  },

  async register(input: {
    companyName: string;
    email: string;
    password: string;
    fullName: string;
  }): Promise<AuthServiceResult<ReturnType<typeof formatUserAuthResponse>>> {
    const emailAvailabilityFailure = await ensureRegistrationEmailAvailable(input.email);
    if (emailAvailabilityFailure) {
      return emailAvailabilityFailure;
    }

    const { tenant, user } = await createTenantAndAdminUser(input);
    await provisionRegisteredTenant(tenant.id);

    return successResult(formatUserAuthResponse(user, signToken), 201);
  },

  async getCurrentUser(user: JwtPayload): Promise<AuthServiceResult<ReturnType<typeof formatCurrentAppUser>>> {
    if (isPlatformAdminRole(user.role) && user.userId > 0) {
      const [admin] = await authRepository.findPlatformAdminById(user.userId);
      if (!admin || !admin.isActive) {
        return failureResult(401, "Admin not found");
      }

      return successResult(formatCurrentPlatformAdmin(admin));
    }

    if (user.role === "super_admin") {
      const superAdmin = getSuperAdminUser();
      if (!superAdmin) {
        return failureResult(401, "Super admin is not configured");
      }

      return successResult(formatCurrentSuperAdmin(superAdmin));
    }

    const [appUser] = await authRepository.findUserById(user.userId);
    if (!appUser) {
      return failureResult(401, "User not found");
    }

    return successResult(formatCurrentAppUser(appUser));
  },

  async changePassword(
    user: JwtPayload,
    reqMeta: { ip: string | undefined },
    input: { currentPassword: string; newPassword: string },
  ): Promise<AuthServiceResult<{ success: true; migrated?: boolean }>> {
    const rateKey = `${user.userId}:${reqMeta.ip ?? "unknown"}`;
    const rateLimit = checkRateLimit(rateKey);
    if (rateLimit.limited) {
      return failureResult(429, "Too many attempts. Please try again later.");
    }

    if (!isStrongPassword(input.newPassword)) {
      return failureResult(400, "Password must be at least 8 characters and include upper, lower, and number");
    }

    if (isPlatformAdminRole(user.role) || user.role === "super_admin") {
      const platformAdmin = user.userId > 0
        ? ((await authRepository.findPlatformAdminById(user.userId))[0] ?? null)
        : null;

      if (platformAdmin) {
        return changePlatformAdminPassword(platformAdmin, input, rateKey);
      }

      return changeSuperAdminPassword(user, input, rateKey);
    }

    return changeAppUserPassword(user, input, rateKey);
  },
  };
}

export const authService = createAuthService();
