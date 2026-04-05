import {
  db,
  planFeaturesTable,
  planPricesTable,
  plansTable,
  subscriptionHistoryTable,
  tenantSubscriptionsTable,
  tenantsTable,
  usersTable,
} from "@workspace/db";
import { and, count, desc, eq, inArray, isNull, or } from "drizzle-orm";

export const plansRepository = {
  listPlans() {
    return db.select().from(plansTable).orderBy(plansTable.sortOrder, plansTable.id);
  },

  listPrices(planIds: number[]) {
    if (planIds.length === 0) return Promise.resolve([] as Array<typeof planPricesTable.$inferSelect>);
    return db.select().from(planPricesTable).where(inArray(planPricesTable.planId, planIds));
  },

  listFeatures(planIds: number[]) {
    if (planIds.length === 0) return Promise.resolve([] as Array<typeof planFeaturesTable.$inferSelect>);
    return db.select().from(planFeaturesTable).where(inArray(planFeaturesTable.planId, planIds));
  },

  listSubscriberCounts() {
    return db
      .select({ planId: tenantSubscriptionsTable.planId, count: count() })
      .from(tenantSubscriptionsTable)
      .groupBy(tenantSubscriptionsTable.planId);
  },

  getPlanByCode(code: string) {
    return db.select().from(plansTable).where(eq(plansTable.code, code)).then((rows) => rows[0]);
  },

  getPlanById(id: number) {
    return db.select().from(plansTable).where(eq(plansTable.id, id)).then((rows) => rows[0]);
  },

  getPlanPrice(planId: number, interval: string) {
    return db.select().from(planPricesTable).where(and(eq(planPricesTable.planId, planId), eq(planPricesTable.interval, interval))).then((rows) => rows[0]);
  },

  async updatePlanPrice(planId: number, interval: string, payload: Partial<typeof planPricesTable.$inferInsert>) {
    const existing = await this.getPlanPrice(planId, interval);
    if (existing) {
      const [updated] = await db.update(planPricesTable)
        .set(payload)
        .where(eq(planPricesTable.id, existing.id))
        .returning();
      return updated!;
    }

    const [created] = await db.insert(planPricesTable).values({
      planId,
      interval,
      currency: payload.currency ?? "EGP",
      amount: payload.amount ?? 0,
      trialDays: payload.trialDays ?? 0,
      stripePriceId: payload.stripePriceId ?? null,
      localPaymentEnabled: payload.localPaymentEnabled ?? true,
      isActive: payload.isActive ?? true,
    }).returning();
    return created!;
  },

  getTenantById(tenantId: number) {
    return db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId)).then((rows) => rows[0]);
  },

  getTenantSubscription(tenantId: number) {
    return db.select().from(tenantSubscriptionsTable).where(eq(tenantSubscriptionsTable.tenantId, tenantId)).then((rows) => rows[0]);
  },

  listTenantSubscriptionsByPlan(planId: number) {
    return db.select().from(tenantSubscriptionsTable).where(eq(tenantSubscriptionsTable.planId, planId));
  },

  listTenantSubscriptionsByPlanForInterval(planId: number, interval: "monthly" | "yearly") {
    return db
      .select({
        subscription: tenantSubscriptionsTable,
        subscriptionInterval: tenantsTable.subscriptionInterval,
        currentPlanPriceInterval: planPricesTable.interval,
      })
      .from(tenantSubscriptionsTable)
      .innerJoin(tenantsTable, eq(tenantsTable.id, tenantSubscriptionsTable.tenantId))
      .leftJoin(planPricesTable, eq(planPricesTable.id, tenantSubscriptionsTable.planPriceId))
      .where(and(
        eq(tenantSubscriptionsTable.planId, planId),
        or(
          eq(tenantsTable.subscriptionInterval, interval),
          and(isNull(tenantsTable.subscriptionInterval), eq(planPricesTable.interval, interval)),
        ),
      ));
  },

  async upsertPlan(input: typeof plansTable.$inferInsert) {
    const existing = await this.getPlanByCode(input.code!);
    if (existing) {
      const [updated] = await db.update(plansTable).set(input).where(eq(plansTable.id, existing.id)).returning();
      return updated!;
    }
    const [created] = await db.insert(plansTable).values(input).returning();
    return created!;
  },

  async upsertTenantSubscription(tx: any, tenantId: number, payload: typeof tenantSubscriptionsTable.$inferInsert) {
    const existingRows = await tx.select().from(tenantSubscriptionsTable).where(eq(tenantSubscriptionsTable.tenantId, tenantId));
    const existing = existingRows[0];
    if (existing) {
      const [updated] = await tx.update(tenantSubscriptionsTable).set(payload).where(eq(tenantSubscriptionsTable.id, existing.id)).returning();
      return updated!;
    }
    const [created] = await tx.insert(tenantSubscriptionsTable).values(payload).returning();
    return created!;
  },

  insertSubscriptionHistory(tx: any, payload: typeof subscriptionHistoryTable.$inferInsert) {
    return tx.insert(subscriptionHistoryTable).values(payload);
  },

  updateTenantLegacyBilling(tx: any, tenantId: number, payload: Partial<typeof tenantsTable.$inferInsert>) {
    return tx.update(tenantsTable).set(payload).where(eq(tenantsTable.id, tenantId));
  },

  getUserById(userId: number) {
    return db.select().from(usersTable).where(eq(usersTable.id, userId)).then((rows) => rows[0]);
  },

  listSubscriptionHistory(tenantId: number, limit = 20) {
    return db.select().from(subscriptionHistoryTable).where(eq(subscriptionHistoryTable.tenantId, tenantId)).orderBy(desc(subscriptionHistoryTable.createdAt)).limit(limit);
  },
};
