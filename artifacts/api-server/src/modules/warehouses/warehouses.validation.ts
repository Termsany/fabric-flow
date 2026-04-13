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
  toWarehouseId: positiveInteger("toWarehouseId").optional(),
  fromWarehouseLocationId: positiveInteger("fromWarehouseLocationId").optional(),
  toWarehouseLocationId: positiveInteger("toWarehouseLocationId").optional(),
  movementType: z.enum(["inbound", "outbound", "transfer", "reserve", "adjustment"]).optional(),
  reason: optionalText(),
}).superRefine((value, ctx) => {
  const type = value.movementType ?? "transfer";
  if (type === "transfer" && value.fromWarehouseId != null && value.fromWarehouseId === value.toWarehouseId) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fromWarehouseId and toWarehouseId must be different",
      path: ["toWarehouseId"],
    });
  }
  if (type === "inbound" && value.toWarehouseId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "toWarehouseId is required for inbound movements",
      path: ["toWarehouseId"],
    });
  }
  if (type === "outbound" && value.fromWarehouseId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "fromWarehouseId is required for outbound movements",
      path: ["fromWarehouseId"],
    });
  }
  if (type === "adjustment" && value.fromWarehouseId == null && value.toWarehouseId == null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "adjustment must include fromWarehouseId or toWarehouseId",
      path: ["fromWarehouseId"],
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
