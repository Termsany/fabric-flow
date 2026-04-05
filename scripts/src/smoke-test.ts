const baseUrl = (process.env.SMOKE_BASE_URL || process.env.APP_URL || "http://localhost:3000").replace(/\/+$/, "");
const superAdminEmail = process.env.SMOKE_SUPER_ADMIN_EMAIL || process.env.SUPER_ADMIN_EMAIL || "superadmin@fabric.local";
const superAdminPassword = process.env.SMOKE_SUPER_ADMIN_PASSWORD || process.env.SUPER_ADMIN_PASSWORD || "superadmin123";

type LoginResponse = {
  token: string;
  user: {
    id: number;
    tenantId: number;
    email: string;
    role: string;
  };
};

async function jsonFetch<T>(path: string, init?: RequestInit, token?: string): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      ...(init?.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });

  const data = await response.json().catch(() => null) as { error?: string; message?: string } | null;
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}: ${data?.error || data?.message || "Unknown error"}`);
  }

  return data as T;
}

async function main() {
  const suffix = Date.now();
  const originalTenantPassword = "Smoke123A";
  const changedTenantPassword = "Smoke456A";
  const resetTenantPassword = "Smoke789A";
  const tenantEmail = `smoke-${suffix}@example.com`;
  const companyName = `Smoke Tenant ${suffix}`;

  console.log("1. Registering temporary tenant");
  const register = await jsonFetch<LoginResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      companyName,
      fullName: "Smoke Admin",
      email: tenantEmail,
      password: originalTenantPassword,
    }),
  });

  const tenantToken = register.token;
  const tenantId = register.user.tenantId;
  const tenantUserId = register.user.id;

  console.log("2. Logging in as super admin");
  const superAdmin = await jsonFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: superAdminEmail,
      password: superAdminPassword,
    }),
  });

  console.log("3. Verifying super admin access");
  await jsonFetch("/api/admin/tenants", undefined, superAdmin.token);

  console.log("4. Enabling InstaPay globally and for the temporary tenant");
  const methods = await jsonFetch<Array<{
    code: "instapay" | "vodafone_cash";
    name_ar: string;
    name_en: string;
    category: string;
    is_globally_enabled: boolean;
    supports_manual_review: boolean;
    sort_order: number;
  }>>("/api/admin/payment-methods", undefined, superAdmin.token);

  const instapay = methods.find((item) => item.code === "instapay");
  if (!instapay) {
    throw new Error("InstaPay definition not found");
  }

  await jsonFetch(`/api/admin/payment-methods/instapay`, {
    method: "PATCH",
    body: JSON.stringify({
      ...instapay,
      is_globally_enabled: true,
    }),
  }, superAdmin.token);

  await jsonFetch(`/api/admin/tenants/${tenantId}/payment-methods/instapay`, {
    method: "PATCH",
    body: JSON.stringify({
      is_active: true,
      account_number: "01012345678",
      account_name: companyName,
      instructions_ar: "حول المبلغ وارفع صورة التحويل",
      instructions_en: "Transfer the amount and upload the proof",
      metadata: {},
    }),
  }, superAdmin.token);

  console.log("5. Verifying tenant billing and visible payment methods");
  const subscription = await jsonFetch<{
    manualPayment: {
      localAmountEgp: number;
      methods: Array<{ method: string }>;
    };
  }>("/api/billing/subscription", undefined, tenantToken);

  await jsonFetch("/api/billing/payment-methods", undefined, tenantToken);
  if (!subscription.manualPayment.methods.some((method) => method.method === "instapay")) {
    throw new Error("InstaPay is not visible on tenant billing page");
  }

  console.log("6. Submitting a manual payment");
  const proofBytes = Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
    0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
    0x54, 0x08, 0x99, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
    0x00, 0x03, 0x01, 0x01, 0x00, 0xc9, 0xfe, 0x92,
    0xef, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82,
  ]);

  const form = new FormData();
  form.set("method", "instapay");
  form.set("amount", String(subscription.manualPayment.localAmountEgp));
  form.set("reference_number", `SMOKE-${suffix}`);
  form.set("proof_image", new Blob([proofBytes], { type: "image/png" }), "proof.png");

  await jsonFetch("/api/billing/pay", {
    method: "POST",
    body: form,
  }, tenantToken);

  console.log("7. Reviewing the manual payment as super admin");
  const adminPayments = await jsonFetch<Array<{ id: number; tenantId: number; status: string }>>("/api/admin/payments", undefined, superAdmin.token);
  const pendingPayment = adminPayments.find((payment) => payment.tenantId === tenantId && payment.status === "pending");
  if (!pendingPayment) {
    throw new Error("Pending payment not found");
  }

  await jsonFetch(`/api/admin/payments/${pendingPayment.id}/approve`, {
    method: "PATCH",
  }, superAdmin.token);

  console.log("8. Changing tenant admin password");
  await jsonFetch("/api/auth/change-password", {
    method: "POST",
    body: JSON.stringify({
      currentPassword: originalTenantPassword,
      newPassword: changedTenantPassword,
    }),
  }, tenantToken);

  console.log("9. Resetting tenant admin password from super admin");
  await jsonFetch(`/api/admin/tenants/${tenantId}/users/${tenantUserId}/password`, {
    method: "PATCH",
    body: JSON.stringify({
      newPassword: resetTenantPassword,
    }),
  }, superAdmin.token);

  console.log("10. Verifying login with the reset password");
  await jsonFetch<LoginResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({
      email: tenantEmail,
      password: resetTenantPassword,
    }),
  });

  console.log("Smoke test passed");
}

main().catch((error) => {
  console.error("Smoke test failed");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
