import { Router } from "express";
import { requireAuth } from "../../lib/auth";
import { checkSubscription } from "../../lib/billing";
import { requireOperationalAccess } from "../../lib/tenant-rbac";
import { warehousesController } from "./warehouses.controller";

export type WarehousesRoutesDependencies = {
  requireAuth: typeof requireAuth;
  checkSubscription: typeof checkSubscription;
  warehousesController: typeof warehousesController;
};

function registerWarehouseRoutes(
  router: Router,
  deps: {
    requireAuth: typeof requireAuth;
    checkSubscription: typeof checkSubscription;
    warehousesController: typeof warehousesController;
  },
) {
  router.get(
    "/warehouses/inventory-report",
    deps.requireAuth,
    requireOperationalAccess("warehouse", "read"),
    deps.warehousesController.getInventoryReport,
  );
  router.get("/warehouses", deps.requireAuth, requireOperationalAccess("warehouse", "read"), deps.warehousesController.listWarehouses);
  router.post(
    "/warehouses",
    deps.requireAuth,
    requireOperationalAccess("warehouse", "write"),
    deps.checkSubscription(),
    deps.warehousesController.createWarehouse,
  );
  router.get("/warehouses/:id", deps.requireAuth, requireOperationalAccess("warehouse", "read"), deps.warehousesController.getWarehouse);
  router.patch("/warehouses/:id", deps.requireAuth, requireOperationalAccess("warehouse", "write"), deps.warehousesController.updateWarehouse);
}

function registerWarehouseMovementRoutes(
  router: Router,
  deps: {
    requireAuth: typeof requireAuth;
    warehousesController: typeof warehousesController;
  },
) {
  router.get("/warehouse-movements", deps.requireAuth, requireOperationalAccess("warehouse", "read"), deps.warehousesController.listWarehouseMovements);
  router.post("/warehouse-movements", deps.requireAuth, requireOperationalAccess("warehouse", "write"), deps.warehousesController.createWarehouseMovement);
}

export function createWarehousesRoutes(
  deps: WarehousesRoutesDependencies = {
    requireAuth,
    checkSubscription,
    warehousesController,
  },
) {
  const router = Router();
  registerWarehouseRoutes(router, deps);
  registerWarehouseMovementRoutes(router, deps);

  return router;
}

export default createWarehousesRoutes();
