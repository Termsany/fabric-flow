import { apiClientRequest } from "@/lib/api-client";

export interface BillingPlanDetails {
  key: "basic" | "pro" | "enterprise";
  name: string;
  monthlyPriceId: string | null;
  yearlyPriceId: string | null;
  features: string[];
}

export interface BillingSubscription {
  statusSummary: {
    state: "active" | "trialing" | "scheduled_cancel" | "past_due" | "unpaid" | "incomplete" | "canceled";
    severity: "success" | "info" | "warning" | "danger";
    hasAccess: boolean;
    needsAttention: boolean;
    isEndingSoon: boolean;
    nextRelevantAt: string | null;
    nextRelevantType: "trial_end" | "renewal" | "cancellation" | null;
    lastInvoiceStatus: string | null;
  };
  tenantId: number;
  currentPlan: "basic" | "pro" | "enterprise";
  subscriptionInterval: "monthly" | "yearly" | null;
  billingStatus: "trialing" | "active" | "past_due" | "canceled" | "unpaid" | "incomplete";
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  subscriptionEndsAt: string | null;
  trialEndsAt: string | null;
  lastInvoiceStatus: string | null;
  isActive: boolean;
  usage: {
    users: number;
    warehouses: number;
  };
  limits: {
    users: number | null;
    warehouses: number | null;
  };
  plans: BillingPlanDetails[];
  manualPayment: {
    amount: number;
    amountUsd: number;
    localAmountEgp: number;
    baseCurrency: "USD" | "EGP";
    localCurrency: "EGP";
    usdExchangeRate: number;
    interval: "monthly" | "yearly";
    instructions: {
      currency: string;
      instapay: {
        account: string;
        note: string;
      };
      vodafoneCash: {
        number: string;
        note: string;
      };
    };
    methods: Array<{
      method: "instapay" | "vodafone_cash";
      accountNumber: string;
      accountName: string;
      instructionsAr: string;
    }>;
  };
}

export interface BillingPayment {
  id: number;
  amount: number;
  method: "instapay" | "vodafone_cash";
  status: "pending" | "approved" | "rejected" | "pending_review";
  referenceNumber: string;
  proofImageUrl: string;
  reviewedAt: string | null;
  createdAt: string;
  reviewerName: string | null;
}

export interface BillingInvoice {
  id: number;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  issuedAt: string;
  dueAt: string | null;
  paidAt: string | null;
  notes: string | null;
}

const billingFetch = apiClientRequest;

export function getBillingSubscription(): Promise<BillingSubscription> {
  return billingFetch<BillingSubscription>("/api/billing/subscription", { method: "GET" });
}

export function createBillingCheckoutSession(body: {
  plan: "basic" | "pro" | "enterprise";
  interval?: "monthly" | "yearly";
}): Promise<{ url: string }> {
  return billingFetch<{ url: string }>("/api/billing/checkout-session", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createBillingCustomerPortal(): Promise<{ url: string }> {
  return billingFetch<{ url: string }>("/api/billing/customer-portal", {
    method: "POST",
  });
}

export async function submitManualPayment(form: FormData): Promise<{ id: number; status: string; proofImageUrl: string; createdAt: string }> {
  return apiClientRequest("/api/billing/pay", {
    method: "POST",
    headers: {},
    body: form,
  });
}

export function listManualPayments(): Promise<BillingPayment[]> {
  return billingFetch<BillingPayment[]>("/api/billing/payments", {
    method: "GET",
  });
}

export function listBillingInvoices(): Promise<BillingInvoice[]> {
  return billingFetch<BillingInvoice[]>("/api/billing/invoices", {
    method: "GET",
  });
}
