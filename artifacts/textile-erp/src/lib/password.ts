import { apiClientRequest } from "@/lib/api-client";

export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return apiClientRequest<{ success: boolean }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resetUserPassword(userId: number, body: { newPassword: string }) {
  return apiClientRequest<{ success: boolean; id: number }>(`/api/admin/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function resetTenantUserPasswordBySuperAdmin(tenantId: number, userId: number, body: { newPassword: string }) {
  return apiClientRequest<{ success: boolean; id: number }>(`/api/admin/tenants/${tenantId}/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
