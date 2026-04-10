import {
  comparePassword,
  getSuperAdminUser,
  hashPassword,
  isPlatformAdminRole,
  signToken,
  verifyPlatformAdminCredentials,
  verifySuperAdminCredentials,
  type JwtPayload,
  type PlatformAdminRole,
} from "../../lib/auth";
import {
  clearRateLimit,
  checkRateLimit,
  isStrongPassword,
} from "./auth.support";

export type AuthSuccessResult<T> = {
  ok: true;
  status: number;
  data: T;
};

export type AuthFailureResult = {
  ok: false;
  status: number;
  error: string;
};

export type AuthServiceResult<T> = AuthSuccessResult<T> | AuthFailureResult;

export function successResult<T>(data: T, status = 200): AuthSuccessResult<T> {
  return { ok: true, status, data };
}

export function failureResult(status: number, error: string): AuthFailureResult {
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
    createTenantWithAdmin?: (input: {
      tenant: {
        name: string;
        currentPlan: string;
        billingStatus: string;
        trialEndsAt: Date;
        subscriptionEndsAt: Date;
      };
      user: {
        tenantId: number;
        email: string;
        passwordHash: string;
        fullName: string;
        role: string;
        isActive: boolean;
      };
    }) => Promise<{
      tenant: { id: number };
      user: {
        id: number;
        tenantId: number;
        email: string;
        fullName: string;
        role: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
      };
    }>;
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
  isPlatformAdminRole: (role: string) => role is PlatformAdminRole;
};
