import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { z } from "zod";

export const CHANGE_PASSWORD_VALIDATION_MESSAGE = "Invalid password input";

/**
 * Keep controller-level validation intentionally light.
 * The auth service remains the source of truth for password policy
 * (strength, composition, rate limiting, actor-specific checks).
 *
 * We only validate what the service already expects structurally:
 * - current password must be present
 * - new password must not be trivially short
 */
export const currentPasswordInputSchema = z.string().min(1);
export const newPasswordInputSchema = z.string().min(8);

export const changePasswordSchema = z.object({
  currentPassword: currentPasswordInputSchema,
  newPassword: newPasswordInputSchema,
});

export type ValidationParseResult<T> = z.SafeParseReturnType<unknown, T>;

export const parseLoginBody = (input: unknown) => LoginBody.safeParse(input);
export const parseRegisterBody = (input: unknown) => RegisterBody.safeParse(input);
export const parseChangePasswordBody = (input: unknown) => changePasswordSchema.safeParse(input);
