import { Router } from "express";
import { requireAuth } from "../../lib/auth";
import { checkPlanAccess } from "../../lib/billing";
import { salesController } from "./sales.controller";

export type SalesRoutesDependencies = {
  requireAuth: typeof requireAuth;
  checkPlanAccess: typeof checkPlanAccess;
  salesController: typeof salesController;
};

export function createSalesRoutes(deps: SalesRoutesDependencies = {
  requireAuth,
  checkPlanAccess,
  salesController,
}) {
  const router = Router();
  const auth = deps.requireAuth;
  const planAccess = deps.checkPlanAccess;
  const controller = deps.salesController;

  router.get("/customers", auth, planAccess("pro"), controller.listCustomers);
  router.post("/customers", auth, planAccess("pro"), controller.createCustomer);
  router.get("/customers/:id", auth, planAccess("pro"), controller.getCustomer);
  router.patch("/customers/:id", auth, planAccess("pro"), controller.updateCustomer);

  router.get("/sales-orders", auth, planAccess("pro"), controller.listSalesOrders);
  router.post("/sales-orders", auth, planAccess("pro"), controller.createSalesOrder);
  router.get("/sales-orders/:id", auth, planAccess("pro"), controller.getSalesOrder);
  router.patch("/sales-orders/:id", auth, planAccess("pro"), controller.updateSalesOrder);

  return router;
}

export default createSalesRoutes();
