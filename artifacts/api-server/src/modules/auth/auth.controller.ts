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

function respondValidationError(res: Response, message: string): void {
  res.status(400).json(buildValidationError(message));
}

function respondAuthError(res: Response, status: number, error: string): void {
  res.status(status).json(buildAuthError(error));
}

function respondInvalidCredentials(res: Response): void {
  res.status(401).json(buildInvalidCredentialsError());
}

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
      respondValidationError(res, parsed.error.message);
      return;
    }

    const result = await authService.login(parsed.data.email, parsed.data.password);
    if (!result.ok) {
      if (result.status === 401 && result.error === "Invalid credentials") {
        respondInvalidCredentials(res);
        return;
      }

      respondAuthError(res, result.status, result.error);
      return;
    }

    attachSessionCookie(res, result.data.token);
    res.json(result.data);
  },

  async register(req: Request, res: Response): Promise<void> {
    const parsed = parseRegisterBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, parsed.error.message);
      return;
    }

    const result = await authService.register(parsed.data);
    if (!result.ok) {
      respondAuthError(res, result.status, result.error);
      return;
    }

    attachSessionCookie(res, result.data.token);
    res.status(result.status).json(result.data);
  },

  async getMe(req: Request, res: Response): Promise<void> {
    const result = await authService.getCurrentUser(req.user!);
    if (!result.ok) {
      respondAuthError(res, result.status, result.error);
      return;
    }

    res.json(formatCurrentUserResponse(result.data));
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    const parsed = parseChangePasswordBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, "Invalid password input");
      return;
    }

    const result = await authService.changePassword(req.user!, { ip: req.ip }, parsed.data);
    if (!result.ok) {
      respondAuthError(res, result.status, result.error);
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
