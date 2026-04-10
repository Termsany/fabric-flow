import type { JwtPayload } from "../../lib/auth";
import { failureResult, successResult, type AuthServiceDependencies, type AuthServiceResult } from "./auth.types";

export function createChangePasswordUseCase(deps: AuthServiceDependencies) {
  const {
    authRepository,
    getSuperAdminUser,
    verifySuperAdminCredentials,
    comparePassword,
    hashPassword,
    checkRateLimit,
    clearRateLimit,
    isStrongPassword,
    isPlatformAdminRole,
  } = deps;

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
    if (!appUser || appUser.tenantId !== user.tenantId) {
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

  return async function changePassword(
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
  };
}
