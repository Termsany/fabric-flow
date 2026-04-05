import { getApiUrl, getToken } from "@/lib/auth";

export interface TenantPaymentMethodSettings {
  method: "instapay" | "vodafone_cash";
  globalIsActive: boolean;
  tenantIsActive: boolean;
  isActive: boolean;
  accountNumber: string;
  accountName: string;
  instructionsAr: string;
}

async function settingsFetch<T>(path: string, init?: RequestInit): Promise<T> {
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

export function getPaymentMethodSettings() {
  return settingsFetch<TenantPaymentMethodSettings[]>("/api/settings/payment-methods");
}

export function updatePaymentMethodSettings(
  method: "instapay" | "vodafone_cash",
  body: {
    is_active: boolean;
    account_number?: string;
    account_name?: string;
    instructions?: string;
  },
) {
  return settingsFetch<TenantPaymentMethodSettings>(`/api/settings/payment-methods/${method}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
