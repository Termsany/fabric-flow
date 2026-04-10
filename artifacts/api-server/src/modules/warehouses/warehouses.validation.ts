import {
  CreateWarehouseBody,
  CreateWarehouseMovementBody,
  GetWarehouseParams,
  ListWarehouseMovementsQueryParams,
  UpdateWarehouseBody,
  UpdateWarehouseParams,
} from "@workspace/api-zod";

export const parseCreateWarehouseBody = (input: unknown) => CreateWarehouseBody.safeParse(input);
export const parseGetWarehouseParams = (input: unknown) => GetWarehouseParams.safeParse(input);
export const parseUpdateWarehouseParams = (input: unknown) => UpdateWarehouseParams.safeParse(input);
export const parseUpdateWarehouseBody = (input: unknown) => UpdateWarehouseBody.safeParse(input);
export const parseListWarehouseMovementsQuery = (input: unknown) => ListWarehouseMovementsQueryParams.safeParse(input);
export const parseCreateWarehouseMovementBody = (input: unknown) => CreateWarehouseMovementBody.safeParse(input);
