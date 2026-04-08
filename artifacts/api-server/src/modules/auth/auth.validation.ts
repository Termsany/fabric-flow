import { LoginBody, RegisterBody } from "@workspace/api-zod";
import { z } from "zod";

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export const parseLoginBody = (input: unknown) => LoginBody.safeParse(input);
export const parseRegisterBody = (input: unknown) => RegisterBody.safeParse(input);
export const parseChangePasswordBody = (input: unknown) => changePasswordSchema.safeParse(input);
