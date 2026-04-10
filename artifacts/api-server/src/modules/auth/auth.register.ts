import { buildTenantAdminValues, buildTenantRegistrationValues, buildTrialWindow } from "./auth.logic";
import { formatUserAuthResponse } from "./auth.mappers";
import { failureResult, successResult, type AuthServiceDependencies, type AuthServiceResult } from "./auth.types";

export function createRegisterUseCase(deps: AuthServiceDependencies) {
  const {
    authRepository,
    hashPassword,
    signToken,
    paymentMethodsService,
    plansService,
  } = deps;

  async function ensureRegistrationEmailAvailable(email: string) {
    const [existing] = await authRepository.findUserByEmail(email);
    if (existing) {
      return failureResult(400, "Email already registered");
    }

    return null;
  }

  async function createTenantAndAdminUser(input: {
    companyName: string;
    email: string;
    password: string;
    fullName: string;
  }) {
    const trialWindow = buildTrialWindow();
    const tenantValues = buildTenantRegistrationValues(input.companyName, trialWindow);
    const passwordHash = await hashPassword(input.password);
    const userValues = buildTenantAdminValues({
      tenantId: 0,
      email: input.email,
      passwordHash,
      fullName: input.fullName,
    });

    if (authRepository.createTenantWithAdmin) {
      return authRepository.createTenantWithAdmin({
        tenant: tenantValues,
        user: userValues,
      });
    }

    const [tenant] = await authRepository.createTenant(tenantValues);
    const [user] = await authRepository.createUser(
      buildTenantAdminValues({
        tenantId: tenant.id,
        email: input.email,
        passwordHash,
        fullName: input.fullName,
      }),
    );

    return { tenant, user };
  }

  async function provisionRegisteredTenant(tenantId: number) {
    await paymentMethodsService.initializeTenantPaymentMethods(tenantId);
    await plansService.ensureTenantSubscription(tenantId);
  }

  async function completeRegistrationProvisioning(tenantId: number) {
    try {
      await provisionRegisteredTenant(tenantId);
    } catch (error) {
      // Follow-up: if registration provisioning becomes a recurring failure mode,
      // add retry and/or compensation at the provisioning boundary instead of
      // expanding this auth flow into a larger saga.
      throw new Error("Registration provisioning failed after core account creation", {
        cause: error,
      });
    }
  }

  return async function register(input: {
    companyName: string;
    email: string;
    password: string;
    fullName: string;
  }): Promise<AuthServiceResult<ReturnType<typeof formatUserAuthResponse>>> {
    const emailAvailabilityFailure = await ensureRegistrationEmailAvailable(input.email);
    if (emailAvailabilityFailure) {
      return emailAvailabilityFailure;
    }

    const { tenant, user } = await createTenantAndAdminUser(input);
    await completeRegistrationProvisioning(tenant.id);

    return successResult(formatUserAuthResponse(user, signToken), 201);
  };
}
