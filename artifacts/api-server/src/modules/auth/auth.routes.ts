import { Router } from "express";
import { requireAuth } from "../../lib/auth";
import { authController } from "./auth.controller";

export type AuthRoutesDependencies = {
  requireAuth: typeof requireAuth;
  authController: typeof authController;
};

export function createAuthRoutes(deps: AuthRoutesDependencies = {
  requireAuth,
  authController,
}) {
  const router = Router();
  const auth = deps.requireAuth;
  const controller = deps.authController;

  router.post("/auth/login", controller.login);
  router.post("/auth/register", controller.register);
  router.post("/auth/logout", controller.logout);
  router.get("/auth/me", auth, controller.getMe);
  router.post("/auth/change-password", auth, controller.changePassword);

  return router;
}

export default createAuthRoutes();
