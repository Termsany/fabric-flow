import { formatEnvSuperAdminAuthResponse, formatUserAuthResponse } from "./auth.mappers";
import { failureResult, successResult, type AuthServiceDependencies } from "./auth.types";

export function createLoginUseCase(deps: AuthServiceDependencies) {
  const {
    authRepository,
    verifyPlatformAdminCredentials,
    getSuperAdminUser,
    verifySuperAdminCredentials,
    comparePassword,
    signToken,
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

  return async function login(email: string, password: string) {
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
  };
}
