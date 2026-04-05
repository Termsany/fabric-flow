import { getApiUrl, getToken } from "@/lib/auth";

export type PaymentMethodCode = "instapay" | "vodafone_cash";

export interface AdminPaymentMethodDefinition {
  code: PaymentMethodCode;
  name_ar: string;
  name_en: string;
  category: string;
  is_globally_enabled: boolean;
  supports_manual_review: boolean;
  sort_order: number;
  tenants_count: number;
  updated_at: string;
}

export interface TenantPaymentMethodRecord {
  id: number;
  tenant_id: number;
  code: PaymentMethodCode;
  name_ar: string;
  name_en: string;
  is_globally_enabled: boolean;
  is_active: boolean;
  account_number: string;
  account_name: string;
  instructions_ar: string;
  instructions_en: string;
  metadata: Record<string, unknown>;
  updated_at: string;
  updated_by_name: string | null;
}

export interface PaymentMethodTenantUsage {
  tenant_id: number;
  tenant_name: string;
  is_active: boolean;
  updated_at: string;
}

export interface BillingPaymentMethodQr {
  method: PaymentMethodCode;
  amount: number;
  amountUsd: number;
  currency: "EGP";
  usdCurrency: "USD";
  usdExchangeRate: number;
  accountNumber: string;
  accountName: string;
  instructionsAr: string;
  qrImageDataUrl: string;
  qrPayload: string;
  cached: boolean;
}

async function paymentMethodFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  const response = await fetch(getApiUrl(path), {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    if (data?.message && data?.errors) {
      const firstError = Object.values<string[]>(data.errors)[0]?.[0];
      throw new Error(firstError || data.message);
    }
    throw new Error(data?.error || data?.message || `HTTP ${response.status}`);
  }
  return data as T;
}

export function getAdminPaymentMethods() {
  return paymentMethodFetch<AdminPaymentMethodDefinition[]>("/api/admin/payment-methods");
}

export function updateAdminPaymentMethod(code: PaymentMethodCode, payload: {
  name_ar: string;
  name_en: string;
  category: string;
  is_globally_enabled: boolean;
  supports_manual_review: boolean;
  sort_order: number;
}) {
  return paymentMethodFetch<AdminPaymentMethodDefinition>(`/api/admin/payment-methods/${code}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getPaymentMethodTenants(code: PaymentMethodCode) {
  return paymentMethodFetch<PaymentMethodTenantUsage[]>(`/api/admin/payment-methods/${code}/tenants`);
}

export function getAdminTenantPaymentMethods(tenantId: number) {
  return paymentMethodFetch<TenantPaymentMethodRecord[]>(`/api/admin/tenants/${tenantId}/payment-methods`);
}

export function updateAdminTenantPaymentMethod(tenantId: number, code: PaymentMethodCode, payload: {
  is_active: boolean;
  account_number: string;
  account_name: string;
  instructions_ar: string;
  instructions_en: string;
  metadata?: Record<string, unknown>;
}) {
  return paymentMethodFetch<TenantPaymentMethodRecord>(`/api/admin/tenants/${tenantId}/payment-methods/${code}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getSettingsPaymentMethods() {
  return paymentMethodFetch<TenantPaymentMethodRecord[]>("/api/settings/payment-methods");
}

export function updateSettingsPaymentMethod(code: PaymentMethodCode, payload: {
  is_active: boolean;
  account_number: string;
  account_name: string;
  instructions_ar: string;
  instructions_en: string;
  metadata?: Record<string, unknown>;
}) {
  return paymentMethodFetch<TenantPaymentMethodRecord>(`/api/settings/payment-methods/${code}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function getBillingPaymentMethods() {
  return paymentMethodFetch<TenantPaymentMethodRecord[]>("/api/billing/payment-methods");
}

export function getBillingPaymentMethodQr(method: PaymentMethodCode, amount?: number) {
  const params = new URLSearchParams({ method });
  if (typeof amount === "number" && Number.isFinite(amount) && amount > 0) {
    params.set("amount", String(amount));
  }
  return paymentMethodFetch<BillingPaymentMethodQr>(`/api/billing/payment-methods/qr?${params.toString()}`);
}
