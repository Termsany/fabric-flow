import { Router } from "express";
import { requireAuth, requireTenantRole } from "../../lib/auth";
import { notificationsController } from "./notifications.controller";

const TENANT_NOTIFICATION_ROLES = [
  "tenant_admin",
  "production_user",
  "dyeing_user",
  "qc_user",
  "warehouse_user",
  "sales_user",
] as const;

export type NotificationsRoutesDependencies = {
  requireAuth: typeof requireAuth;
  requireTenantRole: typeof requireTenantRole;
  notificationsController: typeof notificationsController;
};

export function createNotificationsRoutes(
  deps: NotificationsRoutesDependencies = {
    requireAuth,
    requireTenantRole,
    notificationsController,
  },
) {
  const router = Router();

  router.get(
    "/notifications",
    deps.requireAuth,
    deps.requireTenantRole([...TENANT_NOTIFICATION_ROLES]),
    deps.notificationsController.listNotifications,
  );

  router.post(
    "/notifications/read",
    deps.requireAuth,
    deps.requireTenantRole([...TENANT_NOTIFICATION_ROLES]),
    deps.notificationsController.markNotificationsRead,
  );

  router.post(
    "/notifications/:id/read",
    deps.requireAuth,
    deps.requireTenantRole([...TENANT_NOTIFICATION_ROLES]),
    deps.notificationsController.markNotificationRead,
  );

  return router;
}

export default createNotificationsRoutes();
