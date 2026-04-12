import type { Request, Response } from "express";
import {
  GetWarehouseResponse,
  GetInventoryReportResponse,
  ListWarehouseMovementsResponseItem,
  ListWarehouseMovementsResponse,
  ListWarehousesResponse,
  UpdateWarehouseResponse,
} from "@workspace/api-zod";
import {
  respondDomainError,
  respondInvalidId,
  respondNotFound,
  respondValidationError,
} from "../../lib/controller-responses";
import { warehousesService } from "./warehouses.service";
import {
  getWarehouseValidationMessage,
  parseCreateWarehouseBody,
  parseCreateWarehouseMovementBody,
  parseGetInventoryReportQuery,
  parseGetWarehouseParams,
  parseListWarehouseMovementsQuery,
  parseUpdateWarehouseBody,
  parseUpdateWarehouseParams,
} from "./warehouses.validation";

function respondWarehouseLimitReached(
  res: Response,
  result: { error: string; current: number; limit: number | null },
): void {
  res.status(403).json({
    error: result.error,
    current: result.current,
    limit: result.limit,
  });
}

function respondWarehouseMovementFailure(
  res: Response,
  result: { error: string; status?: number },
): void {
  respondDomainError(res, result);
}

function hasWarehouseLimitError(
  result: unknown,
): result is { error: string; current: number; limit: number | null } {
  return typeof result === "object"
    && result !== null
    && "error" in result
    && "current" in result
    && "limit" in result;
}

function hasWarehouseMovementError(
  result: unknown,
): result is { error: string; status?: number } {
  return typeof result === "object"
    && result !== null
    && "error" in result;
}

export type WarehousesControllerDependencies = {
  warehousesService: {
    listWarehouses: typeof warehousesService.listWarehouses;
    createWarehouse: typeof warehousesService.createWarehouse;
    getWarehouse: typeof warehousesService.getWarehouse;
    updateWarehouse: typeof warehousesService.updateWarehouse;
    listWarehouseMovements: typeof warehousesService.listWarehouseMovements;
    createWarehouseMovement: typeof warehousesService.createWarehouseMovement;
    getInventoryReport: typeof warehousesService.getInventoryReport;
  };
};

export function createWarehousesController(
  deps: WarehousesControllerDependencies = { warehousesService },
) {
  const { warehousesService } = deps;

  return {
    async listWarehouses(req: Request, res: Response): Promise<void> {
      const warehouses = await warehousesService.listWarehouses(req.user!.tenantId);
      res.json(ListWarehousesResponse.parse(warehouses));
    },

    async getInventoryReport(req: Request, res: Response): Promise<void> {
      const params = parseGetInventoryReportQuery(req.query);
      if (!params.success) {
        respondValidationError(res, getWarehouseValidationMessage(params.error));
        return;
      }

      const report = await warehousesService.getInventoryReport(req.user!.tenantId, params.data);
      res.json(GetInventoryReportResponse.parse(report));
    },

    async createWarehouse(req: Request, res: Response): Promise<void> {
      const parsed = parseCreateWarehouseBody(req.body);
      if (!parsed.success) {
        respondValidationError(res, getWarehouseValidationMessage(parsed.error));
        return;
      }

      const result = await warehousesService.createWarehouse(req.user!.tenantId, parsed.data);
      if (hasWarehouseLimitError(result)) {
        respondWarehouseLimitReached(res, result);
        return;
      }

      res.status(201).json(GetWarehouseResponse.parse(result.data));
    },

    async getWarehouse(req: Request, res: Response): Promise<void> {
      const params = parseGetWarehouseParams(req.params);
      if (!params.success) {
        respondInvalidId(res);
        return;
      }

      const warehouse = await warehousesService.getWarehouse(req.user!.tenantId, params.data.id);
      if (!warehouse) {
        respondNotFound(res, "Warehouse not found");
        return;
      }

      res.json(GetWarehouseResponse.parse(warehouse));
    },

    async updateWarehouse(req: Request, res: Response): Promise<void> {
      const params = parseUpdateWarehouseParams(req.params);
      if (!params.success) {
        respondInvalidId(res);
        return;
      }
      const parsed = parseUpdateWarehouseBody(req.body);
      if (!parsed.success) {
        respondValidationError(res, getWarehouseValidationMessage(parsed.error));
        return;
      }

      const warehouse = await warehousesService.updateWarehouse(req.user!.tenantId, params.data.id, parsed.data);
      if (!warehouse) {
        respondNotFound(res, "Warehouse not found");
        return;
      }

      res.json(UpdateWarehouseResponse.parse(warehouse));
    },

    async listWarehouseMovements(req: Request, res: Response): Promise<void> {
      const params = parseListWarehouseMovementsQuery(req.query);
      if (!params.success) {
        respondValidationError(res, getWarehouseValidationMessage(params.error));
        return;
      }

      const movements = await warehousesService.listWarehouseMovements(req.user!.tenantId, params.data);
      res.json(ListWarehouseMovementsResponse.parse(movements));
    },

    async createWarehouseMovement(req: Request, res: Response): Promise<void> {
      const parsed = parseCreateWarehouseMovementBody(req.body);
      if (!parsed.success) {
        respondValidationError(res, getWarehouseValidationMessage(parsed.error));
        return;
      }

      const result = await warehousesService.createWarehouseMovement(
        req.user!.tenantId,
        req.user!.userId,
        parsed.data,
      );
      if (hasWarehouseMovementError(result)) {
        respondWarehouseMovementFailure(res, result);
        return;
      }

      res.status(201).json(ListWarehouseMovementsResponseItem.parse(result.data));
    },
  };
}

export const warehousesController = createWarehousesController();
