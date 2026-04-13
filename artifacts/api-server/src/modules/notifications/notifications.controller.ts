import type { Request, Response } from "express";
import {
  ListNotificationsQueryParams,
  ListNotificationsResponse,
  MarkNotificationReadParams,
  MarkNotificationReadResponse,
  MarkNotificationsReadBody,
  MarkNotificationsReadResponse,
} from "@workspace/api-zod";
import { notificationsService } from "./notifications.service";
import {
  parseListNotificationsQuery,
  parseMarkNotificationReadParams,
  parseMarkNotificationsReadBody,
} from "./notifications.validation";
import { respondInvalidId, respondNotFound, respondValidationError } from "../../lib/controller-responses";

export const notificationsController = {
  async listNotifications(req: Request, res: Response): Promise<void> {
    const params = parseListNotificationsQuery(req.query);
    if (!params.success) {
      respondValidationError(res, params.error);
      return;
    }

    const notifications = await notificationsService.listNotifications(req.user!.tenantId, params.data);
    res.json(ListNotificationsResponse.parse(notifications));
  },

  async markNotificationRead(req: Request, res: Response): Promise<void> {
    const params = parseMarkNotificationReadParams(req.params);
    if (!params.success) {
      respondInvalidId(res);
      return;
    }

    const notification = await notificationsService.markNotificationRead(req.user!.tenantId, params.data.id);
    if (!notification) {
      respondNotFound(res, "Notification not found");
      return;
    }

    res.json(MarkNotificationReadResponse.parse(notification));
  },

  async markNotificationsRead(req: Request, res: Response): Promise<void> {
    const parsed = parseMarkNotificationsReadBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, parsed.error);
      return;
    }

    const results = await Promise.all(parsed.data.ids.map((id) =>
      notificationsService.markNotificationRead(req.user!.tenantId, id),
    ));

    res.json(MarkNotificationsReadResponse.parse(results.filter(Boolean)));
  },
};
