import { Router } from "express";
import { requireAdminPermission, requireAuth, requireTenantAdmin } from "../../lib/auth";
import { plansController } from "./plans.controller";

const router = Router();

router.get("/admin/plans", requireAuth, requireAdminPermission("billing.read"), (req, res) => plansController.listAdminPlans(req, res));
router.post("/admin/plans", requireAuth, requireAdminPermission("billing.write"), (req, res) => plansController.createAdminPlan(req, res));
router.patch("/admin/plans/:id", requireAuth, requireAdminPermission("billing.write"), (req, res) => plansController.updateAdminPlan(req, res));
router.patch("/admin/plans/:id/price", requireAuth, requireAdminPermission("billing.write"), (req, res) => plansController.updateAdminPlanPrice(req, res));
router.post("/admin/plans/:id/apply-price-all", requireAuth, requireAdminPermission("billing.write"), (req, res) => plansController.applyPlanPriceAll(req, res));
router.post("/admin/plans/:id/apply-price-selected", requireAuth, requireAdminPermission("billing.write"), (req, res) => plansController.applyPlanPriceSelected(req, res));

router.get("/plans/public", (req, res) => plansController.listPublicPlans(req, res));

router.get("/billing/current-subscription", requireAuth, requireTenantAdmin, (req, res) => plansController.getCurrentSubscription(req, res));
router.post("/billing/subscribe", requireAuth, requireTenantAdmin, (req, res) => plansController.subscribe(req, res));
router.post("/billing/change-plan", requireAuth, requireTenantAdmin, (req, res) => plansController.changePlan(req, res));
router.post("/billing/cancel-subscription", requireAuth, requireTenantAdmin, (req, res) => plansController.cancelSubscription(req, res));

export default router;
