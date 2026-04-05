import { Router } from "express";
import { requireAuth } from "../../middleware/auth.middleware";
import { requireAdminPermission, requireTenantAdmin } from "../../middleware/rbac.middleware";
import { paymentMethodsController } from "./payment-methods.controller";

const router = Router();

router.get("/admin/payment-methods", requireAuth, requireAdminPermission("payment_methods.view_global"), (req, res) =>
  paymentMethodsController.listAdminPaymentMethods(req, res));
router.patch("/admin/payment-methods/:code", requireAuth, requireAdminPermission("payment_methods.manage_global"), (req, res) =>
  paymentMethodsController.updateGlobalPaymentMethod(req, res));
router.get("/admin/payment-methods/:code/tenants", requireAuth, requireAdminPermission("tenant_payment_methods.view_any"), (req, res) =>
  paymentMethodsController.listPaymentMethodTenants(req, res));
router.get("/admin/tenants/:tenantId/payment-methods", requireAuth, requireAdminPermission("tenant_payment_methods.view_any"), (req, res) =>
  paymentMethodsController.listTenantPaymentMethods(req, res));
router.patch("/admin/tenants/:tenantId/payment-methods/:code", requireAuth, requireAdminPermission("tenant_payment_methods.manage_any"), (req, res) =>
  paymentMethodsController.updateTenantPaymentMethod(req, res));

router.get("/billing/payment-methods", requireAuth, requireTenantAdmin, (req, res) =>
  paymentMethodsController.listBillingPaymentMethods(req, res));

export default router;
