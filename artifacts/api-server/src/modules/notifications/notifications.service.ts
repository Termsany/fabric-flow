import { and, eq, inArray, lt } from "drizzle-orm";
import {
  invoicesTable,
  notificationsTable,
  productionOrdersTable,
  tenantSubscriptionsTable,
  tenantsTable,
  warehouseMovementsTable,
  warehousesTable,
} from "@workspace/db";
import { db } from "@workspace/db";
import { deriveStockByWarehouse } from "../warehouses/warehouses.inventory";
import { notificationsRepository } from "./notifications.repository";

type NotificationSeverity = "info" | "warning" | "critical";

type OperationalAlertCandidate = {
  tenantId: number;
  type: string;
  title: string;
  message: string;
  severity: NotificationSeverity;
  entityType?: string | null;
  entityId?: number | null;
  dedupeWindowHours?: number;
};

function formatNotification(n: typeof notificationsTable.$inferSelect) {
  return {
    id: n.id,
    tenantId: n.tenantId,
    userId: n.userId ?? null,
    type: n.type,
    title: n.title,
    message: n.message,
    severity: n.severity as NotificationSeverity,
    entityType: n.entityType ?? null,
    entityId: n.entityId ?? null,
    isRead: n.isRead,
    readAt: n.readAt?.toISOString() ?? null,
    createdAt: n.createdAt.toISOString(),
  };
}

function buildOperationalAlertCandidates(input: {
  tenantId: number;
  now: Date;
  stuckOrders: Array<{ id: number; orderNumber: string; createdAt: Date }>;
  overdueInvoices: Array<{ id: number; invoiceNumber: string; status: string; dueAt: Date }>;
  subscription: typeof tenantSubscriptionsTable.$inferSelect | null;
  warehouses: Array<{ id: number; name: string }>;
  stockByWarehouse: Map<number, number>;
  tenantBillingStatus: string | null;
}): OperationalAlertCandidate[] {
  const candidates: OperationalAlertCandidate[] = [];
  const subscriptionExpiringBy = new Date(input.now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const trialEndingBy = new Date(input.now.getTime() + 3 * 24 * 60 * 60 * 1000);

  for (const order of input.stuckOrders) {
    candidates.push({
      tenantId: input.tenantId,
      type: "production_delayed",
      title: "Production delayed",
      message: `Production order ${order.orderNumber} has been in progress for more than 7 days.`,
      severity: "warning",
      entityType: "production_order",
      entityId: order.id,
    });
  }

  for (const invoice of input.overdueInvoices) {
    candidates.push({
      tenantId: input.tenantId,
      type: "unpaid_invoice",
      title: "Unpaid invoice",
      message: `Invoice ${invoice.invoiceNumber} is past due.`,
      severity: "critical",
      entityType: "invoice",
      entityId: invoice.id,
    });
  }

  if (input.subscription?.currentPeriodEnd && input.subscription.currentPeriodEnd < subscriptionExpiringBy) {
    candidates.push({
      tenantId: input.tenantId,
      type: "subscription_expiring",
      title: "Subscription expiring",
      message: "Your subscription is expiring within 7 days. Please review billing to avoid disruption.",
      severity: "warning",
      entityType: "tenant_subscription",
      entityId: input.subscription.id,
    });
  }

  for (const warehouse of input.warehouses) {
    const stock = input.stockByWarehouse.get(warehouse.id) ?? 0;
    if (stock <= 2) {
      candidates.push({
        tenantId: input.tenantId,
        type: "low_stock",
        title: "Low stock",
        message: `Warehouse ${warehouse.name} is running low with ${stock} rolls.`,
        severity: "warning",
        entityType: "warehouse",
        entityId: warehouse.id,
        dedupeWindowHours: 12,
      });
    }
  }

  if (input.tenantBillingStatus && ["past_due", "unpaid", "incomplete"].includes(String(input.tenantBillingStatus))) {
    candidates.push({
      tenantId: input.tenantId,
      type: "subscription_unpaid",
      title: "Billing issue",
      message: "Billing status requires attention. Please review your payment status.",
      severity: "critical",
      entityType: "tenant",
      entityId: input.tenantId,
      dedupeWindowHours: 6,
    });
  }

  if (input.subscription?.trialEndsAt && input.subscription.trialEndsAt < trialEndingBy) {
    candidates.push({
      tenantId: input.tenantId,
      type: "trial_ending",
      title: "Trial ending soon",
      message: "Your trial ends within 3 days. Upgrade to keep access.",
      severity: "warning",
      entityType: "tenant_subscription",
      entityId: input.subscription.id,
    });
  }

  return candidates;
}

export type NotificationsServiceDependencies = {
  db: typeof db;
  notificationsRepository: typeof notificationsRepository;
  deriveStockByWarehouse: typeof deriveStockByWarehouse;
};

export function createNotificationsService(
  deps: NotificationsServiceDependencies = {
    db,
    notificationsRepository,
    deriveStockByWarehouse,
  },
) {
  async function createNotificationOnce(input: {
    tenantId: number;
    userId?: number | null;
    type: string;
    title: string;
    message: string;
    severity: NotificationSeverity;
    entityType?: string | null;
    entityId?: number | null;
    dedupeWindowHours?: number;
  }) {
    const since = new Date(Date.now() - (input.dedupeWindowHours ?? 24) * 60 * 60 * 1000);
    const [existing] = await deps.notificationsRepository.findRecentNotification(input.tenantId, {
      type: input.type,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      since,
    });

    if (existing) {
      return formatNotification(existing);
    }

    const [created] = await deps.notificationsRepository.insertNotification({
      tenantId: input.tenantId,
      userId: input.userId ?? null,
      type: input.type,
      title: input.title,
      message: input.message,
      severity: input.severity,
      entityType: input.entityType ?? null,
      entityId: input.entityId ?? null,
      isRead: false,
    });

    return formatNotification(created);
  }

  const service = {
    async listNotifications(tenantId: number, params: { unreadOnly?: boolean; limit?: number; offset?: number; refresh?: boolean }) {
      if (params.refresh) {
        await service.generateOperationalAlerts(tenantId);
      }

      const notifications = await deps.notificationsRepository.listNotifications(tenantId, {
        unreadOnly: params.unreadOnly,
        limit: params.limit ?? 50,
        offset: params.offset ?? 0,
      });

      return notifications.map(formatNotification);
    },

    async markNotificationRead(tenantId: number, id: number) {
      const [notification] = await deps.notificationsRepository.markNotificationRead(tenantId, id, new Date());
      return notification ? formatNotification(notification) : null;
    },

    async createNotification(input: Parameters<typeof createNotificationOnce>[0]) {
      return createNotificationOnce(input);
    },

    async generateOperationalAlerts(tenantId: number) {
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      const [stuckOrders, overdueInvoices, subscription] = await Promise.all([
        deps.db.select({
          id: productionOrdersTable.id,
          orderNumber: productionOrdersTable.orderNumber,
          createdAt: productionOrdersTable.createdAt,
        }).from(productionOrdersTable)
          .where(and(
            eq(productionOrdersTable.tenantId, tenantId),
            eq(productionOrdersTable.status, "IN_PROGRESS"),
            lt(productionOrdersTable.createdAt, sevenDaysAgo),
          ))
          .limit(5),
        deps.db.select({
          id: invoicesTable.id,
          invoiceNumber: invoicesTable.invoiceNumber,
          status: invoicesTable.status,
          dueAt: invoicesTable.dueAt,
        }).from(invoicesTable)
          .where(and(
            eq(invoicesTable.tenantId, tenantId),
            inArray(invoicesTable.status, ["ISSUED", "OVERDUE"]),
            lt(invoicesTable.dueAt, now),
          ))
          .limit(5),
        deps.db.select().from(tenantSubscriptionsTable)
          .where(eq(tenantSubscriptionsTable.tenantId, tenantId))
          .limit(1),
      ]);

      const movements = await deps.db.select({
        fabricRollId: warehouseMovementsTable.fabricRollId,
        fromWarehouseId: warehouseMovementsTable.fromWarehouseId,
        toWarehouseId: warehouseMovementsTable.toWarehouseId,
        movedAt: warehouseMovementsTable.movedAt,
        createdAt: warehouseMovementsTable.createdAt,
      }).from(warehouseMovementsTable)
        .where(eq(warehouseMovementsTable.tenantId, tenantId));

      const warehouses = await deps.db.select({
        id: warehousesTable.id,
        name: warehousesTable.name,
        capacity: warehousesTable.capacity,
      }).from(warehousesTable).where(eq(warehousesTable.tenantId, tenantId));

      const stockByWarehouse = movements.length
        ? deps.deriveStockByWarehouse(movements).stockByWarehouse
        : new Map<number, number>();

      const [tenant] = await deps.db.select({ billingStatus: tenantsTable.billingStatus }).from(tenantsTable)
        .where(eq(tenantsTable.id, tenantId)).limit(1);

      const candidates = buildOperationalAlertCandidates({
        tenantId,
        now,
        stuckOrders,
        overdueInvoices,
        subscription: subscription ?? null,
        warehouses,
        stockByWarehouse,
        tenantBillingStatus: tenant?.billingStatus ?? null,
      });

      for (const candidate of candidates) {
        await createNotificationOnce(candidate);
      }
    },
  };

  return service;
}

export const notificationsService = createNotificationsService();
export { buildOperationalAlertCandidates };
