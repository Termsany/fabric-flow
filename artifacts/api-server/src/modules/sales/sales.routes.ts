import { Router } from "express";
import { requireAuth } from "../../lib/auth";
import { checkPlanAccess } from "../../lib/billing";
import { requireOperationalAccess } from "../../lib/tenant-rbac";
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

  router.get("/customers", auth, requireOperationalAccess("sales", "read"), planAccess("pro"), controller.listCustomers);
  router.post("/customers", auth, requireOperationalAccess("sales", "write"), planAccess("pro"), controller.createCustomer);
  router.get("/customers/:id", auth, requireOperationalAccess("sales", "read"), planAccess("pro"), controller.getCustomer);
  router.patch("/customers/:id", auth, requireOperationalAccess("sales", "write"), planAccess("pro"), controller.updateCustomer);

  router.get("/sales-orders", auth, requireOperationalAccess("sales", "read"), planAccess("pro"), controller.listSalesOrders);
  router.get("/sales-orders/report", auth, requireOperationalAccess("sales", "read"), planAccess("pro"), controller.getSalesReport);
  router.post("/sales-orders", auth, requireOperationalAccess("sales", "write"), planAccess("pro"), controller.createSalesOrder);
  router.get("/sales-orders/:id", auth, requireOperationalAccess("sales", "read"), planAccess("pro"), controller.getSalesOrder);
  router.patch("/sales-orders/:id", auth, requireOperationalAccess("sales", "write"), planAccess("pro"), controller.updateSalesOrder);

  return router;
}

export default createSalesRoutes();
