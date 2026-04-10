import type { Request, Response } from "express";
import {
  GetWarehouseResponse,
  ListWarehouseMovementsResponse,
  ListWarehousesResponse,
  UpdateWarehouseResponse,
} from "@workspace/api-zod";
import { warehousesService } from "./warehouses.service";
import {
  parseCreateWarehouseBody,
  parseCreateWarehouseMovementBody,
  parseGetWarehouseParams,
  parseListWarehouseMovementsQuery,
  parseUpdateWarehouseBody,
  parseUpdateWarehouseParams,
} from "./warehouses.validation";

function respondValidationError(res: Response, message: string): void {
  res.status(400).json({ error: message });
}

function respondInvalidId(res: Response): void {
  res.status(400).json({ error: "Invalid ID" });
}

function respondNotFound(res: Response, entity: "Warehouse" | "movement"): void {
  const message = entity === "Warehouse" ? "Warehouse not found" : "Warehouse movement not found";
  res.status(404).json({ error: message });
}

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
  res.status(result.status ?? 404).json({ error: result.error });
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

    async createWarehouse(req: Request, res: Response): Promise<void> {
      const parsed = parseCreateWarehouseBody(req.body);
      if (!parsed.success) {
        respondValidationError(res, parsed.error.message);
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
        respondNotFound(res, "Warehouse");
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
        respondValidationError(res, parsed.error.message);
        return;
      }

      const warehouse = await warehousesService.updateWarehouse(req.user!.tenantId, params.data.id, parsed.data);
      if (!warehouse) {
        respondNotFound(res, "Warehouse");
        return;
      }

      res.json(UpdateWarehouseResponse.parse(warehouse));
    },

    async listWarehouseMovements(req: Request, res: Response): Promise<void> {
      const params = parseListWarehouseMovementsQuery(req.query);
      if (!params.success) {
        respondValidationError(res, params.error.message);
        return;
      }

      const movements = await warehousesService.listWarehouseMovements(req.user!.tenantId, params.data);
      res.json(ListWarehouseMovementsResponse.parse(movements));
    },

    async createWarehouseMovement(req: Request, res: Response): Promise<void> {
      const parsed = parseCreateWarehouseMovementBody(req.body);
      if (!parsed.success) {
        respondValidationError(res, parsed.error.message);
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

      res.status(201).json(result.data);
    },
  };
}

export const warehousesController = createWarehousesController();
