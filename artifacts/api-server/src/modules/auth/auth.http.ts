import { GetMeResponse } from "@workspace/api-zod";

export function buildValidationError(message: string) {
  return { error: message };
}

export function buildInvalidCredentialsError() {
  return { error: "Invalid credentials" };
}

export function buildAuthError(error: string) {
  return { error };
}

export function formatCurrentUserResponse(data: unknown) {
  return GetMeResponse.parse(data);
}
