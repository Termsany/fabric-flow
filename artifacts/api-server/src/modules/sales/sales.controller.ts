import type { Request, Response } from "express";
import {
  CreateCustomerBody,
  CreateSalesOrderBody,
  GetCustomerParams,
  GetCustomerResponse,
  GetSalesOrderParams,
  GetSalesOrderResponse,
  ListCustomersQueryParams,
  ListCustomersResponse,
  ListSalesOrdersQueryParams,
  ListSalesOrdersResponse,
  UpdateCustomerBody,
  UpdateCustomerParams,
  UpdateCustomerResponse,
  UpdateSalesOrderBody,
  UpdateSalesOrderParams,
  UpdateSalesOrderResponse,
} from "@workspace/api-zod";
import { salesService } from "./sales.service";

export type SalesControllerDependencies = {
  salesService: {
    listCustomers: typeof salesService.listCustomers;
    createCustomer: typeof salesService.createCustomer;
    getCustomer: typeof salesService.getCustomer;
    updateCustomer: typeof salesService.updateCustomer;
    listSalesOrders: typeof salesService.listSalesOrders;
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
      res.status(400).json({ error: params.error.message });
      return;
    }

    const customers = await salesService.listCustomers(req.user!.tenantId, params.data);
    res.json(ListCustomersResponse.parse(customers));
  },

  async createCustomer(req: Request, res: Response): Promise<void> {
    const parsed = CreateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const customer = await salesService.createCustomer(req.user!.tenantId, parsed.data);
    res.status(201).json(GetCustomerResponse.parse(customer));
  },

  async getCustomer(req: Request, res: Response): Promise<void> {
    const params = GetCustomerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const customer = await salesService.getCustomer(req.user!.tenantId, params.data.id);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json(GetCustomerResponse.parse(customer));
  },

  async updateCustomer(req: Request, res: Response): Promise<void> {
    const params = UpdateCustomerParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const parsed = UpdateCustomerBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const customer = await salesService.updateCustomer(req.user!.tenantId, params.data.id, parsed.data);
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    res.json(UpdateCustomerResponse.parse(customer));
  },

  async listSalesOrders(req: Request, res: Response): Promise<void> {
    const params = ListSalesOrdersQueryParams.safeParse(req.query);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const orders = await salesService.listSalesOrders(req.user!.tenantId, params.data);
    res.json(ListSalesOrdersResponse.parse(orders));
  },

  async createSalesOrder(req: Request, res: Response): Promise<void> {
    const parsed = CreateSalesOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await salesService.createSalesOrder(req.user!.tenantId, req.user!.userId, parsed.data);
    if ("error" in result) {
      res.status(result.status ?? 404).json({ error: result.error });
      return;
    }

    res.status(201).json(GetSalesOrderResponse.parse(result.data));
  },

  async getSalesOrder(req: Request, res: Response): Promise<void> {
    const params = GetSalesOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }

    const order = await salesService.getSalesOrder(req.user!.tenantId, params.data.id);
    if (!order) {
      res.status(404).json({ error: "Sales order not found" });
      return;
    }

    res.json(GetSalesOrderResponse.parse(order));
  },

  async updateSalesOrder(req: Request, res: Response): Promise<void> {
    const params = UpdateSalesOrderParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: "Invalid ID" });
      return;
    }
    const parsed = UpdateSalesOrderBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await salesService.updateSalesOrder(req.user!.tenantId, params.data.id, parsed.data);
    if ("error" in result) {
      res.status(404).json({ error: result.error });
      return;
    }

    res.json(UpdateSalesOrderResponse.parse(result.data));
  },
  };
}

export const salesController = createSalesController();
