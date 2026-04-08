import { GetMeResponse } from "@workspace/api-zod";

type AuthUser = {
  id: number;
  tenantId: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

type SuperAdminLike = {
  id: number;
  tenantId: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
};

export function formatUserAuthResponse(
  user: AuthUser,
  signToken: (payload: { userId: number; tenantId: number; role: string; email: string }) => string,
) {
  return {
    token: signToken({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      email: user.email,
    }),
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
  };
}

export function formatEnvSuperAdminAuthResponse(
  superAdmin: SuperAdminLike,
  signToken: (payload: { userId: number; tenantId: number; role: string; email: string }) => string,
) {
  return {
    token: signToken({
      userId: superAdmin.id,
      tenantId: superAdmin.tenantId,
      role: superAdmin.role,
      email: superAdmin.email,
    }),
    user: {
      ...superAdmin,
      createdAt: new Date(0).toISOString(),
      updatedAt: new Date(0).toISOString(),
    },
  };
}

export function formatCurrentPlatformAdmin(admin: {
  id: number;
  email: string;
  fullName: string;
  role: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}) {
  return GetMeResponse.parse({
    id: admin.id,
    tenantId: 0,
    email: admin.email,
    fullName: admin.fullName,
    role: admin.role,
    isActive: admin.isActive,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  });
}

export function formatCurrentSuperAdmin(superAdmin: SuperAdminLike) {
  return GetMeResponse.parse({
    ...superAdmin,
    createdAt: new Date(0).toISOString(),
    updatedAt: new Date(0).toISOString(),
  });
}

export function formatCurrentAppUser(user: AuthUser) {
  return GetMeResponse.parse({
    id: user.id,
    tenantId: user.tenantId,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  });
}
