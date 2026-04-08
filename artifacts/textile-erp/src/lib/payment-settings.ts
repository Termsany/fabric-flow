import { apiClientRequest } from "@/lib/api-client";

export interface TenantPaymentMethodSettings {
  method: "instapay" | "vodafone_cash";
  globalIsActive: boolean;
  tenantIsActive: boolean;
  isActive: boolean;
  accountNumber: string;
  accountName: string;
  instructionsAr: string;
}

export function getPaymentMethodSettings() {
  return apiClientRequest<TenantPaymentMethodSettings[]>("/api/settings/payment-methods");
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
  return apiClientRequest<TenantPaymentMethodSettings>(`/api/settings/payment-methods/${method}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
