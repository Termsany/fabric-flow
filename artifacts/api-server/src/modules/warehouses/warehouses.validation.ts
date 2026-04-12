import {
  CreateWarehouseBody,
  CreateWarehouseMovementBody,
  GetInventoryReportQueryParams,
  GetWarehouseParams,
  ListWarehouseMovementsQueryParams,
  UpdateWarehouseBody,
  UpdateWarehouseParams,
} from "@workspace/api-zod";
import { z } from "zod";
import {
  formatValidationError,
  optionalText,
  positiveInteger,
} from "../../lib/request-validation";

const createWarehouseMovementSchema = CreateWarehouseMovementBody.extend({
  fabricRollId: positiveInteger("fabricRollId"),
  fromWarehouseId: positiveInteger("fromWarehouseId").optional(),
  toWarehouseId: positiveInteger("toWarehouseId"),
  reason: optionalText(),
}).superRefine((value, ctx) => {
  if (value.fromWarehouseId != null && value.fromWarehouseId === value.toWarehouseId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fromWarehouseId and toWarehouseId must be different",
      path: ["toWarehouseId"],
    });
  }
});

const inventoryReportQuerySchema = GetInventoryReportQueryParams.extend({
  lowStockThreshold: z.coerce.number().int().min(0).max(10000).optional(),
});

export const parseCreateWarehouseBody = (input: unknown) => CreateWarehouseBody.safeParse(input);
export const parseGetInventoryReportQuery = (input: unknown) => inventoryReportQuerySchema.safeParse(input);
export const parseGetWarehouseParams = (input: unknown) => GetWarehouseParams.safeParse(input);
export const parseUpdateWarehouseParams = (input: unknown) => UpdateWarehouseParams.safeParse(input);
export const parseUpdateWarehouseBody = (input: unknown) => UpdateWarehouseBody.safeParse(input);
export const parseListWarehouseMovementsQuery = (input: unknown) => ListWarehouseMovementsQueryParams.safeParse(input);
export const parseCreateWarehouseMovementBody = (input: unknown) => createWarehouseMovementSchema.safeParse(input);
export const getWarehouseValidationMessage = formatValidationError;
