import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { plansQueryKeys } from "@/hooks/use-plans";
import {
  getAdminPaymentMethods,
  getAdminTenantPaymentMethods,
  getBillingPaymentMethods,
  getPaymentMethodTenants,
  getSettingsPaymentMethods,
  updateAdminPaymentMethod,
  updateAdminTenantPaymentMethod,
  updateSettingsPaymentMethod,
  type PaymentMethodCode,
} from "@/lib/payment-methods";

export const paymentMethodQueryKeys = {
  adminMethods: ["admin-payment-methods"] as const,
  tenantMethods: (tenantId: number) => ["tenant-payment-methods", tenantId] as const,
  settingsMethods: ["settings-payment-methods"] as const,
  methodTenants: (code: PaymentMethodCode) => ["payment-method-tenants", code] as const,
  billingMethods: ["billing-payment-methods"] as const,
};

export function useAdminPaymentMethods() {
  return useQuery({
    queryKey: paymentMethodQueryKeys.adminMethods,
    queryFn: getAdminPaymentMethods,
  });
}

export function usePaymentMethodTenants(code: PaymentMethodCode | null) {
  return useQuery({
    queryKey: code ? paymentMethodQueryKeys.methodTenants(code) : ["payment-method-tenants", "idle"],
    queryFn: () => getPaymentMethodTenants(code!),
    enabled: Boolean(code),
  });
}

export function useAdminTenantPaymentMethods(tenantId: number) {
  return useQuery({
    queryKey: paymentMethodQueryKeys.tenantMethods(tenantId),
    queryFn: () => getAdminTenantPaymentMethods(tenantId),
    enabled: tenantId > 0,
  });
}

export function useSettingsPaymentMethods() {
  return useQuery({
    queryKey: paymentMethodQueryKeys.settingsMethods,
    queryFn: getSettingsPaymentMethods,
  });
}

export function useBillingPaymentMethods() {
  return useQuery({
    queryKey: paymentMethodQueryKeys.billingMethods,
    queryFn: getBillingPaymentMethods,
  });
}

export function useUpdateAdminPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, payload }: { code: PaymentMethodCode; payload: Parameters<typeof updateAdminPaymentMethod>[1] }) =>
      updateAdminPaymentMethod(code, payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(paymentMethodQueryKeys.adminMethods, (current: any[] | undefined) =>
        current?.map((item) => item.code === data.code ? data : item) ?? current);
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.adminMethods });
      await queryClient.invalidateQueries({ queryKey: ["tenant-payment-methods"] });
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.settingsMethods });
      await queryClient.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.billingMethods });
    },
  });
}

export function useUpdateAdminTenantPaymentMethod(tenantId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, payload }: { code: PaymentMethodCode; payload: Parameters<typeof updateAdminTenantPaymentMethod>[2] }) =>
      updateAdminTenantPaymentMethod(tenantId, code, payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(paymentMethodQueryKeys.tenantMethods(tenantId), (current: any[] | undefined) =>
        current?.map((item) => item.code === data.code ? data : item) ?? current);
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.tenantMethods(tenantId) });
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.adminMethods });
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.methodTenants(data.code) });
      await queryClient.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.billingMethods });
    },
  });
}

export function useUpdateSettingsPaymentMethod() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ code, payload }: { code: PaymentMethodCode; payload: Parameters<typeof updateSettingsPaymentMethod>[1] }) =>
      updateSettingsPaymentMethod(code, payload),
    onSuccess: async (data) => {
      queryClient.setQueryData(paymentMethodQueryKeys.settingsMethods, (current: any[] | undefined) =>
        current?.map((item) => item.code === data.code ? data : item) ?? current);
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.settingsMethods });
      await queryClient.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
      await queryClient.invalidateQueries({ queryKey: paymentMethodQueryKeys.billingMethods });
    },
  });
}
