import { formatCurrentAppUser, formatCurrentPlatformAdmin, formatCurrentSuperAdmin } from "./auth.mappers";
import type { JwtPayload } from "../../lib/auth";
import { failureResult, successResult, type AuthServiceDependencies, type AuthServiceResult } from "./auth.types";

export function createCurrentUserUseCase(deps: AuthServiceDependencies) {
  const {
    authRepository,
    getSuperAdminUser,
    isPlatformAdminRole,
  } = deps;

  return async function getCurrentUser(
    user: JwtPayload,
  ): Promise<AuthServiceResult<ReturnType<typeof formatCurrentAppUser>>> {
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
    if (!appUser || appUser.tenantId !== user.tenantId) {
      return failureResult(401, "User not found");
    }

    return successResult(formatCurrentAppUser(appUser));
  };
}
