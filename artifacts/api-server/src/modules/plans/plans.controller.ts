import type { Request, Response } from "express";
import { toErrorResponse } from "../../utils/errors";
import { paymentMethodsService } from "../payment-methods/payment-methods.service";
import { plansService } from "./plans.service";
import { applyPlanPriceAllSchema, applyPlanPriceSelectedSchema, cancelSubscriptionSchema, changePlanSchema, planUpsertSchema, subscribeSchema, updatePlanPriceSchema } from "./plans.validation";

function parseId(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const plansController = {
  async listAdminPlans(_req: Request, res: Response) {
    try {
      res.json(await plansService.listAdminPlans());
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async createAdminPlan(req: Request, res: Response) {
    const parsed = planUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.status(201).json(await plansService.upsertPlan(req, null, parsed.data));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async updateAdminPlan(req: Request, res: Response) {
    const planId = parseId(String(req.params.id));
    if (!planId) {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }
    const parsed = planUpsertSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.upsertPlan(req, planId, parsed.data));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async updateAdminPlanPrice(req: Request, res: Response) {
    const planId = parseId(String(req.params.id));
    if (!planId) {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }
    const parsed = updatePlanPriceSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.updatePlanPrice(req, planId, parsed.data));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async applyPlanPriceAll(req: Request, res: Response) {
    const planId = parseId(String(req.params.id));
    if (!planId) {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }
    const parsed = applyPlanPriceAllSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.applyPlanPriceToSubscriptions(req, planId, parsed.data));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async applyPlanPriceSelected(req: Request, res: Response) {
    const planId = parseId(String(req.params.id));
    if (!planId) {
      res.status(400).json({ error: "Invalid plan id" });
      return;
    }
    const parsed = applyPlanPriceSelectedSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.applyPlanPriceToSubscriptions(req, planId, parsed.data));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async listPublicPlans(_req: Request, res: Response) {
    try {
      res.json(await plansService.listPublicPlans());
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async getCurrentSubscription(req: Request, res: Response) {
    try {
      res.json({
        subscription: await plansService.getTenantSubscriptionDto(req.user!.tenantId),
        history: await plansService.listSubscriptionHistory(req.user!.tenantId),
        paymentMethods: await paymentMethodsService.listBillingVisiblePaymentMethods(req.user!.tenantId),
      });
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async subscribe(req: Request, res: Response) {
    const parsed = subscribeSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.subscribeTenant(
        req,
        req.user!.tenantId,
        parsed.data.planCode,
        parsed.data.interval,
        parsed.data.paymentMethodCode,
      ));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async changePlan(req: Request, res: Response) {
    const parsed = changePlanSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.subscribeTenant(
        req,
        req.user!.tenantId,
        parsed.data.planCode,
        parsed.data.interval,
        parsed.data.paymentMethodCode,
        parsed.data.notes ?? null,
      ));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },

  async cancelSubscription(req: Request, res: Response) {
    const parsed = cancelSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ message: "Validation failed", errors: parsed.error.flatten().fieldErrors });
      return;
    }
    try {
      res.json(await plansService.cancelTenantSubscription(
        req,
        req.user!.tenantId,
        parsed.data.cancelAtPeriodEnd,
        parsed.data.notes ?? null,
      ));
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  },
};
