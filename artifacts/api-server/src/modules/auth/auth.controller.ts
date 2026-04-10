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
  CHANGE_PASSWORD_VALIDATION_MESSAGE,
  parseChangePasswordBody,
  parseLoginBody,
  parseRegisterBody,
  type ValidationParseResult,
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

function respondUnauthorized(res: Response): void {
  respondAuthError(res, 401, "Unauthorized");
}

function getValidationMessage<T>(parsed: ValidationParseResult<T>, fallback?: string): string {
  if (parsed.success) {
    return fallback ?? "Invalid request";
  }

  return fallback ?? parsed.error.message;
}

function isAuthFailure<T>(result: {
  ok: boolean;
  status: number;
  error?: string;
  data?: T;
}): result is {
  ok: false;
  status: number;
  error: string;
} {
  return !result.ok;
}

function getAuthFailureResponse(result: {
  ok: false;
  status: number;
  error: string;
}) {
  if (result.status === 401 && result.error === "Invalid credentials") {
    return { kind: "invalid-credentials" as const };
  }

  return {
    kind: "auth-error" as const,
    status: result.status,
    error: result.error,
  };
}

function respondServiceFailure(
  res: Response,
  result: {
    ok: false;
    status: number;
    error: string;
  },
): void {
  const failure = getAuthFailureResponse(result);
  if (failure.kind === "invalid-credentials") {
    respondInvalidCredentials(res);
    return;
  }

  respondAuthError(res, failure.status, failure.error);
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
      respondValidationError(res, getValidationMessage(parsed));
      return;
    }

    const result = await authService.login(parsed.data.email, parsed.data.password);
    if (isAuthFailure(result)) {
      respondServiceFailure(res, result);
      return;
    }

    attachSessionCookie(res, result.data.token);
    res.json(result.data);
  },

  async register(req: Request, res: Response): Promise<void> {
    const parsed = parseRegisterBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, getValidationMessage(parsed));
      return;
    }

    const result = await authService.register(parsed.data);
    if (isAuthFailure(result)) {
      respondServiceFailure(res, result);
      return;
    }

    attachSessionCookie(res, result.data.token);
    res.status(result.status).json(result.data);
  },

  async getMe(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      respondUnauthorized(res);
      return;
    }
    const result = await authService.getCurrentUser(req.user!);
    if (isAuthFailure(result)) {
      respondServiceFailure(res, result);
      return;
    }

    res.json(formatCurrentUserResponse(result.data));
  },

  async changePassword(req: Request, res: Response): Promise<void> {
    if (!req.user) {
      respondUnauthorized(res);
      return;
    }
    const parsed = parseChangePasswordBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, getValidationMessage(parsed, CHANGE_PASSWORD_VALIDATION_MESSAGE));
      return;
    }

    const result = await authService.changePassword(req.user!, { ip: req.ip }, parsed.data);
    if (isAuthFailure(result)) {
      respondServiceFailure(res, result);
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
