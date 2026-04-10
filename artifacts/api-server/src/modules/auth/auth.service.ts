import { authRepository } from "./auth.repository";
import {
  comparePassword,
  getSuperAdminUser,
  hashPassword,
  isPlatformAdminRole,
  signToken,
  verifyPlatformAdminCredentials,
  verifySuperAdminCredentials,
} from "../../lib/auth";
import { paymentMethodsService } from "../payment-methods/payment-methods.service";
import { plansService } from "../plans/plans.service";
import {
  clearRateLimit,
  checkRateLimit,
  isStrongPassword,
} from "./auth.support";
import { createLoginUseCase } from "./auth.login";
import { createRegisterUseCase } from "./auth.register";
import { createCurrentUserUseCase } from "./auth.current-user";
import { createChangePasswordUseCase } from "./auth.change-password";
import type { AuthServiceDependencies } from "./auth.types";

export type {
  AuthFailureResult,
  AuthServiceDependencies,
  AuthServiceResult,
  AuthSuccessResult,
} from "./auth.types";

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
  return {
    login: createLoginUseCase(deps),
    register: createRegisterUseCase(deps),
    getCurrentUser: createCurrentUserUseCase(deps),
    changePassword: createChangePasswordUseCase(deps),
  };
}

export const authService = createAuthService();
