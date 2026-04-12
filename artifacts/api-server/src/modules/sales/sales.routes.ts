import { Router } from "express";
import { requireAuth, requireTenantRole } from "../../lib/auth";
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

  router.get("/customers", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.listCustomers);
  router.post("/customers", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.createCustomer);
  router.get("/customers/:id", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.getCustomer);
  router.patch("/customers/:id", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.updateCustomer);

  router.get("/sales-orders", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.listSalesOrders);
  router.get("/sales-orders/report", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.getSalesReport);
  router.post("/sales-orders", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.createSalesOrder);
  router.get("/sales-orders/:id", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.getSalesOrder);
  router.patch("/sales-orders/:id", auth, requireTenantRole(["sales_user"]), planAccess("pro"), controller.updateSalesOrder);

  return router;
}

export default createSalesRoutes();
