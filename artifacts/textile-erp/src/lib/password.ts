import { getApiUrl, getToken } from "@/lib/auth";

async function passwordFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(getApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data?.error || `HTTP ${response.status}`);
  }

  return data as T;
}

export function changePassword(body: { currentPassword: string; newPassword: string }) {
  return passwordFetch<{ success: boolean }>("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function resetUserPassword(userId: number, body: { newPassword: string }) {
  return passwordFetch<{ success: boolean; id: number }>(`/api/admin/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

export function resetTenantUserPasswordBySuperAdmin(tenantId: number, userId: number, body: { newPassword: string }) {
  return passwordFetch<{ success: boolean; id: number }>(`/api/admin/tenants/${tenantId}/users/${userId}/password`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
