import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  applyAdminPlanPriceAll,
  applyAdminPlanPriceSelected,
  cancelSubscription,
  changeSubscriptionPlan,
  createAdminPlan,
  getAdminPlans,
  getCurrentSubscription,
  getPublicPlans,
  subscribePlan,
  updateAdminPlanPrice,
  updateAdminPlan,
  type PlanPriceApplyPayload,
  type PlanPriceApplySelectedPayload,
  type PlanPriceUpdatePayload,
  type PlanUpsertPayload,
} from "@/lib/plans";

export const plansQueryKeys = {
  admin: ["admin-plans"] as const,
  public: ["public-plans"] as const,
  currentSubscription: ["current-subscription"] as const,
};

export function useAdminPlans() {
  return useQuery({
    queryKey: plansQueryKeys.admin,
    queryFn: getAdminPlans,
  });
}

export function usePublicPlans() {
  return useQuery({
    queryKey: plansQueryKeys.public,
    queryFn: getPublicPlans,
  });
}

export function useCurrentSubscription() {
  return useQuery({
    queryKey: plansQueryKeys.currentSubscription,
    queryFn: getCurrentSubscription,
  });
}

export function useCreateAdminPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PlanUpsertPayload) => createAdminPlan(payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.admin });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.public });
    },
  });
}

export function useUpdateAdminPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PlanUpsertPayload }) => updateAdminPlan(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.admin });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.public });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}

export function useUpdateAdminPlanPrice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PlanPriceUpdatePayload }) => updateAdminPlanPrice(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.admin });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.public });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}

export function useApplyAdminPlanPriceAll() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PlanPriceApplyPayload }) => applyAdminPlanPriceAll(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.admin });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}

export function useApplyAdminPlanPriceSelected() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PlanPriceApplySelectedPayload }) => applyAdminPlanPriceSelected(id, payload),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.admin });
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}

export function useSubscribePlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: subscribePlan,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}

export function useChangeSubscriptionPlan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: changeSubscriptionPlan,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}

export function useCancelSubscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: cancelSubscription,
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: plansQueryKeys.currentSubscription });
    },
  });
}
