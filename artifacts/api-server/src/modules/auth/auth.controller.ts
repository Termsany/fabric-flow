import type { Request, Response } from "express";
import { authService } from "./auth.service";
import { attachSessionCookie, clearSessionCookie } from "../../lib/auth";
import {
  buildAuthError,
  buildInvalidCredentialsError,
  buildValidationError,
  formatCurrentUserResponse,
} from "./auth.http";
import {
  parseChangePasswordBody,
  parseLoginBody,
  parseRegisterBody,
} from "./auth.validation";

export type AuthControllerDependencies = {
  authService: {
    login: typeof authService.login;
    register: typeof authService.register;
    getCurrentUser: typeof authService.getCurrentUser;
    changePassword: typeof authService.changePassword;
  };
};

export function createAuthController(deps: AuthControllerDependencies = { authService }) {
  const { authService } = deps;

  return {
  async login(req: Request, res: Response): Promise<void> {
    const parsed = parseLoginBody(req.body);
    if (!parsed.success) {
      res.status(400).json(buildValidationError(parsed.error.message));
      return;
    }

    const result = await authService.login(parsed.data.email, parsed.data.password);
    if (!result) {
      res.status(401).json(buildInvalidCredentialsError());
      return;
    }

    attachSessionCookie(res, result.token);
    res.json(result);
  },

  async register(req: Request, res: Response): Promise<void> {
    const parsed = parseRegisterBody(req.body);
    if (!parsed.success) {
      res.status(400).json(buildValidationError(parsed.error.message));
      return;
    }

    const result = await authService.register(parsed.data);
    if ("error" in result) {
      res.status(400).json(buildAuthError(result.error ?? "Unknown error"));
      return;
    }

    attachSessionCookie(res, result.data.token);
    res.status(201).json(result.data);
  },

  async getMe(req: Request, res: Response): Promise<void> {
    const result = await authService.getCurrentUser(req.user!);
    if ("error" in result) {
      res.status(result.error === "Super admin is not configured" ? 401 : 401).json(buildAuthError(result.error ?? "Unauthorized"));
      return;
    }

    res.json(formatCurrentUserResponse(result.data));
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const parsed = parseChangePasswordBody(req.body);
    if (!parsed.success) {
      res.status(400).json(buildValidationError("Invalid password input"));
      return;
    }

    const result = await authService.changePassword(req.user!, { ip: req.ip }, parsed.data);
    if ("error" in result) {
      res.status(result.status).json(buildAuthError(result.error ?? "Unknown error"));
      return;
    }

    res.status(result.status).json(result.data);
  },

  async logout(_req: Request, res: Response): Promise<void> {
    clearSessionCookie(res);
    res.status(204).send();
  },
  };
}

export const authController = createAuthController();
