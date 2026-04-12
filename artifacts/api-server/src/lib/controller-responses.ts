import type { Response } from "express";
import { formatValidationError } from "./request-validation";

export function respondValidationError(res: Response, error: { issues?: unknown[]; message: string } | string): void {
  const message = typeof error === "string" ? error : formatValidationError(error as never);
  res.status(400).json({ error: message });
}

export function respondInvalidId(res: Response, message = "Invalid ID"): void {
  res.status(400).json({ error: message });
}

export function respondNotFound(res: Response, message: string): void {
  res.status(404).json({ error: message });
}

export function respondDomainError(
  res: Response,
  result: { error: string; status?: number },
  fallbackStatus = 404,
): void {
  res.status(result.status ?? fallbackStatus).json({ error: result.error });
}
