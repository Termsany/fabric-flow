import type { Request, Response } from "express";
import { paymentMethodsService } from "./payment-methods.service";
import {
  formatZodError,
  paymentMethodCodeSchema,
  updateGlobalPaymentMethodSchema,
  updateTenantPaymentMethodSchema,
} from "./payment-methods.validation";
import { createValidationError, toErrorResponse } from "../../utils/errors";

function parseTenantId(value: string) {
  const tenantId = Number(value);
  if (!Number.isInteger(tenantId) || tenantId <= 0) {
    throw createValidationError({ tenantId: ["Invalid tenant id"] });
  }
  return tenantId;
}

export class PaymentMethodsController {
  async listAdminPaymentMethods(_req: Request, res: Response) {
    const data = await paymentMethodsService.listAdminPaymentMethods();
    res.setHeader("Cache-Control", "no-store");
    res.json(data);
  }

  async updateGlobalPaymentMethod(req: Request, res: Response) {
    try {
      const codeResult = paymentMethodCodeSchema.safeParse(req.params.code);
      const bodyResult = updateGlobalPaymentMethodSchema.safeParse(req.body);
      if (!codeResult.success || !bodyResult.success) {
        throw createValidationError({
          ...(codeResult.success ? {} : { code: ["Invalid payment method code"] }),
          ...(bodyResult.success ? {} : formatZodError(bodyResult.error)),
        });
      }

      const data = await paymentMethodsService.updateGlobalDefinition(req, codeResult.data, bodyResult.data);
      res.json({
        code: data.code,
        name_ar: data.nameAr,
        name_en: data.nameEn,
        category: data.category,
        is_globally_enabled: data.isGloballyEnabled,
        supports_manual_review: data.supportsManualReview,
        sort_order: data.sortOrder,
        updated_at: data.updatedAt.toISOString(),
      });
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  }

  async listPaymentMethodTenants(req: Request, res: Response) {
    try {
      const codeResult = paymentMethodCodeSchema.safeParse(req.params.code);
      if (!codeResult.success) {
        throw createValidationError({ code: ["Invalid payment method code"] });
      }
      const data = await paymentMethodsService.listPaymentMethodTenants(codeResult.data);
      res.setHeader("Cache-Control", "no-store");
      res.json(data);
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  }

  async listTenantPaymentMethods(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId ? parseTenantId(Array.isArray(req.params.tenantId) ? req.params.tenantId[0]! : req.params.tenantId) : req.user!.tenantId;
      const data = await paymentMethodsService.listTenantPaymentMethods(tenantId);
      res.setHeader("Cache-Control", "no-store");
      res.json(data);
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  }

  async updateTenantPaymentMethod(req: Request, res: Response) {
    try {
      const tenantId = req.params.tenantId ? parseTenantId(Array.isArray(req.params.tenantId) ? req.params.tenantId[0]! : req.params.tenantId) : req.user!.tenantId;
      const codeResult = paymentMethodCodeSchema.safeParse(req.params.code);
      const bodyResult = updateTenantPaymentMethodSchema.safeParse(req.body);
      if (!codeResult.success || !bodyResult.success) {
        throw createValidationError({
          ...(codeResult.success ? {} : { code: ["Invalid payment method code"] }),
          ...(bodyResult.success ? {} : formatZodError(bodyResult.error)),
        });
      }

      const data = await paymentMethodsService.updateTenantPaymentMethod(req, tenantId, codeResult.data, bodyResult.data);
      res.json(data);
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  }

  async listBillingPaymentMethods(req: Request, res: Response) {
    try {
      const data = await paymentMethodsService.listBillingVisiblePaymentMethods(req.user!.tenantId);
      res.setHeader("Cache-Control", "no-store");
      res.json(data);
    } catch (error) {
      const response = toErrorResponse(error);
      res.status(response.statusCode).json(response.body);
    }
  }
}

export const paymentMethodsController = new PaymentMethodsController();
