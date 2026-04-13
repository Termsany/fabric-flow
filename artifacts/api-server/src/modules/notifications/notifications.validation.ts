import { z } from "zod/v4";

export const listNotificationsQuerySchema = z.object({
  unreadOnly: z.coerce.boolean().optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
  refresh: z.coerce.boolean().optional(),
});

export const markNotificationReadParamsSchema = z.object({
  id: z.coerce.number(),
});

export const markNotificationsReadBodySchema = z.object({
  ids: z.array(z.number()).min(1),
});

export const parseListNotificationsQuery = (input: unknown) => listNotificationsQuerySchema.safeParse(input);
export const parseMarkNotificationReadParams = (input: unknown) => markNotificationReadParamsSchema.safeParse(input);
export const parseMarkNotificationsReadBody = (input: unknown) => markNotificationsReadBodySchema.safeParse(input);
