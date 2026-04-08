export function buildTrialWindow(days = 14) {
  const trialEndsAt = new Date();
  trialEndsAt.setDate(trialEndsAt.getDate() + days);

  return {
    trialEndsAt,
    subscriptionEndsAt: trialEndsAt,
  };
}

export function buildTenantRegistrationValues(companyName: string, trialWindow: ReturnType<typeof buildTrialWindow>) {
  return {
    name: companyName,
    currentPlan: "basic",
    billingStatus: "trialing",
    trialEndsAt: trialWindow.trialEndsAt,
    subscriptionEndsAt: trialWindow.subscriptionEndsAt,
  };
}

export function buildTenantAdminValues(input: {
  tenantId: number;
  email: string;
  passwordHash: string;
  fullName: string;
}) {
  return {
    tenantId: input.tenantId,
    email: input.email,
    passwordHash: input.passwordHash,
    fullName: input.fullName,
    role: "admin",
    isActive: true,
  };
}
