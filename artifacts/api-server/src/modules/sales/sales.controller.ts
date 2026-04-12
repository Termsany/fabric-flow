import type { Request, Response } from "express";
import {
  CreateCustomerBody,
  GetCustomerParams,
  GetCustomerResponse,
  GetSalesReportQueryParams,
  GetSalesReportResponse,
  GetSalesOrderParams,
  GetSalesOrderResponse,
  ListCustomersQueryParams,
  ListCustomersResponse,
  ListSalesOrdersQueryParams,
  ListSalesOrdersResponse,
  UpdateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerResponse,
  UpdateSalesOrderParams,
  UpdateSalesOrderResponse,
} from "@workspace/api-zod";
import {
  respondDomainError,
  respondInvalidId,
  respondNotFound,
  respondValidationError,
} from "../../lib/controller-responses";
import { salesService } from "./sales.service";
import { parseCreateSalesOrderBody, parseUpdateSalesOrderBody } from "./sales.validation";

function isServiceError(result: unknown): result is { error: string; status?: number } {
  return typeof result === "object" && result !== null && "error" in result;
}

export type SalesControllerDependencies = {
  salesService: {
    listCustomers: typeof salesService.listCustomers;
    createCustomer: typeof salesService.createCustomer;
    getCustomer: typeof salesService.getCustomer;
    updateCustomer: typeof salesService.updateCustomer;
    listSalesOrders: typeof salesService.listSalesOrders;
    getSalesReport: typeof salesService.getSalesReport;
    createSalesOrder: typeof salesService.createSalesOrder;
    getSalesOrder: typeof salesService.getSalesOrder;
    updateSalesOrder: typeof salesService.updateSalesOrder;
  };
};

export function createSalesController(deps: SalesControllerDependencies = { salesService }) {
  const { salesService } = deps;

  return {
  async listCustomers(req: Request, res: Response): Promise<void> {
    const params = ListCustomersQueryParams.safeParse(req.query);
    if (!params.success) {
      respondValidationError(res, params.error);
      return;
    }

    const customers = await salesService.listCustomers(req.user!.tenantId, params.data);
    res.json(ListCustomersResponse.parse(customers));
  },

  async createCustomer(req: Request, res: Response): Promise<void> {
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      respondValidationError(res, parsed.error);
      return;
    }

    const customer = await salesService.createCustomer(req.user!.tenantId, parsed.data);
    res.status(201).json(GetCustomerResponse.parse(customer));
  },

  async getCustomer(req: Request, res: Response): Promise<void> {
    const params = GetCustomerParams.safeParse(req.params);
    if (!params.success) {
      respondInvalidId(res);
      return;
    }

    const customer = await salesService.getCustomer(req.user!.tenantId, params.data.id);
    if (!customer) {
      respondNotFound(res, "Customer not found");
      return;
    }

    res.json(GetCustomerResponse.parse(customer));
  },

  async updateCustomer(req: Request, res: Response): Promise<void> {
    const params = UpdateCustomerParams.safeParse(req.params);
    if (!params.success) {
      respondInvalidId(res);
      return;
    }
    const parsed = UpdateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      respondValidationError(res, parsed.error);
      return;
    }

    const customer = await salesService.updateCustomer(req.user!.tenantId, params.data.id, parsed.data);
    if (!customer) {
      respondNotFound(res, "Customer not found");
      return;
    }

    res.json(UpdateCustomerResponse.parse(customer));
  },

  async listSalesOrders(req: Request, res: Response): Promise<void> {
    const params = ListSalesOrdersQueryParams.safeParse(req.query);
    if (!params.success) {
      respondValidationError(res, params.error);
      return;
    }

    const orders = await salesService.listSalesOrders(req.user!.tenantId, params.data);
    res.json(ListSalesOrdersResponse.parse(orders));
  },

  async getSalesReport(req: Request, res: Response): Promise<void> {
    const params = GetSalesReportQueryParams.safeParse(req.query);
    if (!params.success) {
      respondValidationError(res, params.error);
      return;
    }

    const report = await salesService.getSalesReport(req.user!.tenantId, params.data);
    res.json(GetSalesReportResponse.parse(report));
  },

  async createSalesOrder(req: Request, res: Response): Promise<void> {
    const parsed = parseCreateSalesOrderBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, parsed.error);
      return;
    }

    const result = await salesService.createSalesOrder(req.user!.tenantId, req.user!.userId, parsed.data);
    if (isServiceError(result)) {
      respondDomainError(res, result);
      return;
    }

    res.status(201).json(GetSalesOrderResponse.parse(result.data));
  },

  async getSalesOrder(req: Request, res: Response): Promise<void> {
    const params = GetSalesOrderParams.safeParse(req.params);
    if (!params.success) {
      respondInvalidId(res);
      return;
    }

    const order = await salesService.getSalesOrder(req.user!.tenantId, params.data.id);
    if (!order) {
      respondNotFound(res, "Sales order not found");
      return;
    }

    res.json(GetSalesOrderResponse.parse(order));
  },

  async updateSalesOrder(req: Request, res: Response): Promise<void> {
    const params = UpdateSalesOrderParams.safeParse(req.params);
    if (!params.success) {
      respondInvalidId(res);
      return;
    }
    const parsed = parseUpdateSalesOrderBody(req.body);
    if (!parsed.success) {
      respondValidationError(res, parsed.error);
      return;
    }

    const result = await salesService.updateSalesOrder(req.user!.tenantId, params.data.id, parsed.data, req.user!.userId);
    if (isServiceError(result)) {
      respondDomainError(res, result);
      return;
    }

    res.json(UpdateSalesOrderResponse.parse(result.data));
  },
  };
}

export const salesController = createSalesController();
