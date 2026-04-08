import { apiClientRequest } from "@/lib/api-client";

export const adminTenantQueryKeys = {
  all: ["admin-tenants"] as const,
  list: (filters: { search?: string; status?: string; plan?: string }) =>
    [...adminTenantQueryKeys.all, "list", filters.search || "", filters.status || "all", filters.plan || "all"] as const,
  detail: (id: number) => [...adminTenantQueryKeys.all, "detail", id] as const,
  billing: ["admin-billing"] as const,
  monitoring: ["admin-monitoring"] as const,
  payments: (status?: string) => ["admin-payments", status || "all"] as const,
  paymentMethods: ["admin-payment-methods"] as const,
  tenantPaymentMethods: (tenantId: number) => [...adminTenantQueryKeys.paymentMethods, "tenant", tenantId] as const,
};

export interface AdminTenantListItem {
  id: number;
  name: string;
  industry: string;
  country: string;
  isActive: boolean;
  currentPlan: string;
  billingStatus: string;
  subscriptionInterval: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  usersCount: number;
  createdAt: string;
}

export interface AdminTenantDetails extends AdminTenantListItem {
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  updatedAt: string;
  permissions: {
    plan: string;
    features: Record<string, boolean>;
    limits: {
      users: number | null;
      warehouses: number | null;
    };
  };
  usage: {
    usersCount: number;
    activeUsersCount: number;
    warehousesCount: number;
    rollsCount: number;
    inStockRolls: number;
    reservedRolls: number;
    soldRolls: number;
    activeProductionOrders: number;
    activeSalesOrders: number;
  };
  users: Array<{
    id: number;
    fullName: string;
    email: string;
    role: string;
    isActive: boolean;
  }>;
  logs: Array<{
    id: number;
    action: string;
    entityType: string;
    entityId: number;
    changes: string | null;
    userId: number | null;
    userName: string | null;
    createdAt: string;
  }>;
  invoiceHistory: Array<{
    id: number;
    invoiceNumber: string;
    amount: number;
    currency: string;
    status: string;
    issuedAt: string;
    dueAt: string | null;
    paidAt: string | null;
  }>;
  billingActionLogs: Array<{
    id: number;
    action: string;
    adminEmail: string;
    adminRole: string;
    severity: string;
    metadata: string | null;
    createdAt: string;
  }>;
}

export interface AdminBillingSummary {
  totalSubscriptions: number;
  activeSubscriptions: number;
  trialingSubscriptions: number;
  pastDueSubscriptions: number;
  canceledSubscriptions: number;
  mrrEstimate: number;
}

export interface AdminBillingRow {
  id: number;
  name: string;
  currentPlan: string;
  billingStatus: string;
  isActive: boolean;
  subscriptionInterval: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  lastInvoiceStatus: string | null;
  usersCount: number;
}

export interface AdminBillingResponse {
  summary: AdminBillingSummary;
  alerts: Array<{
    id: string;
    tenantId: number;
    tenantName: string;
    severity: "high" | "medium";
    type: "past_due" | "payment_failed" | "ending_soon";
    message: string;
  }>;
  auditLogs: Array<{
    id: number;
    adminEmail: string;
    adminRole: string;
    action: string;
    entityType: string;
    entityId: string | null;
    targetTenantId: number | null;
    severity: string;
    metadata: string | null;
    createdAt: string;
  }>;
  subscriptions: AdminBillingRow[];
}

export interface AdminMonitoringResponse {
  summary: {
    totalTenants: number;
    activeTenants: number;
    inactiveTenants: number;
    pastDueTenants: number;
    trialingTenants: number;
    apiRequestsLast7Days: number;
    estimatedStorageGb: number;
  };
  activityLogs: Array<{
    id: number;
    tenantId: number;
    tenantName: string;
    action: string;
    entityType: string;
    entityId: number;
    createdAt: string;
  }>;
  apiUsage: Array<{
    label: string;
    count: number;
  }>;
  storageUsage: {
    usedGb: number;
    capacityGb: number;
  };
  topActiveTenants: Array<{
    id: number;
    name: string;
    activityCount: number;
    rollsCount: number;
    salesCount: number;
  }>;
  alerts: Array<{
    id: string;
    severity: string;
    type: string;
    tenantName: string;
    message: string;
  }>;
  systemLogs: Array<{
    id: number;
    adminEmail: string;
    adminRole: string;
    action: string;
    entityType: string;
    severity: string;
    createdAt: string;
  }>;
}

export interface AdminPaymentRow {
  id: number;
  tenantId: number;
  tenantName: string;
  amount: number;
  method: "instapay" | "vodafone_cash";
  status: "pending" | "approved" | "rejected" | "pending_review";
  referenceNumber: string;
  proofImageUrl: string;
  createdAt: string;
  reviewedAt: string | null;
  createdByName: string;
  reviewerName: string | null;
}

export interface AdminPaymentMethodDefinition {
  method: "instapay" | "vodafone_cash";
  isActive: boolean;
  accountNumber: string;
  accountName: string;
  instructionsAr: string;
}

export interface AdminTenantPaymentMethod {
  method: "instapay" | "vodafone_cash";
  globalIsActive: boolean;
  tenantIsActive: boolean;
  isActive: boolean;
  accountNumber: string;
  accountName: string;
  instructionsAr: string;
  instructionsEn: string;
  metadata: Record<string, unknown>;
  updatedByName: string | null;
}

const adminFetch = apiClientRequest;

export function listAdminTenants(filters: { search?: string; status?: string; plan?: string }) {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status && filters.status !== "all") params.set("status", filters.status);
  if (filters.plan && filters.plan !== "all") params.set("plan", filters.plan);

  const query = params.toString();
  return adminFetch<AdminTenantListItem[]>(`/api/admin/tenants${query ? `?${query}` : ""}`);
}

export function getAdminTenantDetails(id: number) {
  return adminFetch<AdminTenantDetails>(`/api/admin/tenants/${id}`);
}

export function updateAdminTenantStatus(id: number, isActive: boolean) {
  return adminFetch<{ id: number; name: string; isActive: boolean; currentPlan: string; billingStatus: string; updatedAt: string }>(`/api/admin/tenants/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export function updateAdminTenantPlan(id: number, plan: string) {
  return adminFetch<{ id: number; name: string; isActive: boolean; currentPlan: string; billingStatus: string; updatedAt: string }>(`/api/admin/tenants/${id}/plan`, {
    method: "PATCH",
    body: JSON.stringify({ plan, subscriptionStatus: "active" }),
  });
}

export function impersonateTenantAdmin(id: number) {
  return adminFetch<{ token: string; user: any }>(`/api/admin/tenants/${id}/impersonate`, {
    method: "POST",
  });
}

export function extendAdminTenantTrial(id: number, days: number) {
  return adminFetch<{ id: number; trialEndsAt: string | null; subscriptionEndsAt: string | null; billingStatus: string }>(`/api/admin/tenants/${id}/trial`, {
    method: "PATCH",
    body: JSON.stringify({ days }),
  });
}

export function updateAdminTenantBillingStatus(
  id: number,
  billingStatus: string,
  isActive?: boolean,
  cancelMode?: "immediate" | "end_of_period",
) {
  return adminFetch<{ id: number; billingStatus: string; isActive: boolean; updatedAt: string }>(`/api/admin/tenants/${id}/billing-status`, {
    method: "PATCH",
    body: JSON.stringify({ billingStatus, isActive, cancelMode }),
  });
}

export function syncAdminTenantBilling(id: number) {
  return adminFetch<{
    id: number;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
    billingStatus: string;
    currentPlan: string;
    subscriptionInterval: string | null;
    subscriptionEndsAt: string | null;
    trialEndsAt: string | null;
    lastInvoiceStatus: string | null;
  }>(`/api/admin/tenants/${id}/billing-sync`, {
    method: "POST",
  });
}

export function getAdminBillingOverview() {
  return adminFetch<AdminBillingResponse>("/api/admin/billing");
}

export function getAdminMonitoringOverview() {
  return adminFetch<AdminMonitoringResponse>("/api/admin/monitoring");
}

export function listAdminPayments(filters?: { status?: string; method?: string }) {
  const params = new URLSearchParams();
  if (filters?.status && filters.status !== "all") params.set("status", filters.status);
  if (filters?.method && filters.method !== "all") params.set("method", filters.method);
  const query = params.toString() ? `?${params.toString()}` : "";
  return adminFetch<AdminPaymentRow[]>(`/api/admin/payments${query}`);
}

export function approveAdminPayment(id: number) {
  return adminFetch<{ id: number; status: string }>(`/api/admin/payments/${id}/approve`, {
    method: "PATCH",
  });
}

export function rejectAdminPayment(id: number) {
  return adminFetch<{ id: number; status: string }>(`/api/admin/payments/${id}/reject`, {
    method: "PATCH",
  });
}

export function markAdminPaymentForReview(id: number) {
  return adminFetch<{ id: number; status: string }>(`/api/admin/payments/${id}/review`, {
    method: "PATCH",
  });
}

export function getAdminPaymentMethodDefinitions() {
  return adminFetch<Array<{
    code: "instapay" | "vodafone_cash";
    is_globally_enabled: boolean;
  }>>("/api/admin/payment-methods")
    .then((items) => items.map((item) => ({
      method: item.code,
      isActive: item.is_globally_enabled,
      accountNumber: "",
      accountName: "",
      instructionsAr: "",
    })));
}

export function updateAdminPaymentMethodDefinition(method: AdminPaymentMethodDefinition["method"], payload: {
  is_active: boolean;
  account_number: string;
  account_name: string;
  instructions: string;
}) {
  return adminFetch<{ code: "instapay" | "vodafone_cash"; is_globally_enabled: boolean }>(`/api/admin/payment-methods/${method}`, {
    method: "PATCH",
    body: JSON.stringify({
      name_ar: method === "instapay" ? "إنستا باي" : "فودافون كاش",
      name_en: method === "instapay" ? "InstaPay" : "Vodafone Cash",
      category: "manual",
      is_globally_enabled: payload.is_active,
      supports_manual_review: true,
      sort_order: method === "instapay" ? 1 : 2,
    }),
  }).then((item) => ({
    method: item.code,
    isActive: item.is_globally_enabled,
    accountNumber: payload.account_number,
    accountName: payload.account_name,
    instructionsAr: payload.instructions,
  }));
}

export function getAdminTenantPaymentMethods(tenantId: number) {
  return adminFetch<Array<{
    code: "instapay" | "vodafone_cash";
    is_globally_enabled: boolean;
    is_active: boolean;
    account_number: string;
    account_name: string;
    instructions_ar: string;
    instructions_en: string;
    metadata: Record<string, unknown>;
    updated_by_name: string | null;
  }>>(`/api/admin/tenants/${tenantId}/payment-methods`)
    .then((items) => items.map((item) => ({
      method: item.code,
      globalIsActive: item.is_globally_enabled,
      tenantIsActive: item.is_active,
      isActive: item.is_globally_enabled && item.is_active,
      accountNumber: item.account_number,
      accountName: item.account_name,
      instructionsAr: item.instructions_ar,
      instructionsEn: item.instructions_en,
      metadata: item.metadata,
      updatedByName: item.updated_by_name,
    })));
}

export function updateAdminTenantPaymentMethod(tenantId: number, method: AdminTenantPaymentMethod["method"], payload: {
  is_active: boolean;
  account_number: string;
  account_name: string;
  instructions: string;
  instructions_en?: string;
  metadata?: Record<string, unknown>;
}) {
  return adminFetch<{
    code: "instapay" | "vodafone_cash";
    is_globally_enabled: boolean;
    is_active: boolean;
    account_number: string;
    account_name: string;
    instructions_ar: string;
    instructions_en: string;
    metadata: Record<string, unknown>;
    updated_by_name: string | null;
  }>(`/api/admin/tenants/${tenantId}/payment-methods/${method}`, {
    method: "PATCH",
    body: JSON.stringify({
      is_active: payload.is_active,
      account_number: payload.account_number,
      account_name: payload.account_name,
      instructions_ar: payload.instructions,
      instructions_en: payload.instructions_en ?? "",
      metadata: payload.metadata ?? {},
    }),
  }).then((item) => ({
    method: item.code,
    globalIsActive: item.is_globally_enabled,
    tenantIsActive: item.is_active,
    isActive: item.is_globally_enabled && item.is_active,
    accountNumber: item.account_number,
    accountName: item.account_name,
    instructionsAr: item.instructions_ar,
    instructionsEn: item.instructions_en,
    metadata: item.metadata,
    updatedByName: item.updated_by_name,
  }));
}
