export const PAYMENT_METHOD_CODES = ["instapay", "vodafone_cash"] as const;

export type PaymentMethodCode = (typeof PAYMENT_METHOD_CODES)[number];

export interface PaymentMethodDefinitionDto {
  id: number;
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

export interface TenantPaymentMethodDto {
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

export interface PaymentMethodTenantUsageDto {
  tenant_id: number;
  tenant_name: string;
  is_active: boolean;
  updated_at: string;
}
