import { and, desc, eq, inArray } from "drizzle-orm";
import {
  db,
  paymentMethodDefinitionsTable,
  paymentMethodAuditLogsTable,
  tenantPaymentMethodsTable,
  tenantsTable,
  usersTable,
} from "@workspace/db";
import type { PaymentMethodCode } from "./payment-methods.types";

export class PaymentMethodsRepository {
  async listDefinitions() {
    return db.select().from(paymentMethodDefinitionsTable);
  }

  async getDefinitionByCode(code: PaymentMethodCode) {
    const [row] = await db.select().from(paymentMethodDefinitionsTable).where(eq(paymentMethodDefinitionsTable.code, code));
    return row ?? null;
  }

  async upsertDefinition(code: PaymentMethodCode, values: typeof paymentMethodDefinitionsTable.$inferInsert) {
    const existing = await this.getDefinitionByCode(code);
    if (existing) {
      const [updated] = await db.update(paymentMethodDefinitionsTable)
        .set(values)
        .where(eq(paymentMethodDefinitionsTable.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(paymentMethodDefinitionsTable).values(values).returning();
    return created;
  }

  async listTenantPaymentMethods(tenantId: number) {
    return db.select().from(tenantPaymentMethodsTable).where(eq(tenantPaymentMethodsTable.tenantId, tenantId));
  }

  async getTenantPaymentMethod(tenantId: number, code: PaymentMethodCode) {
    const [row] = await db.select().from(tenantPaymentMethodsTable).where(and(
      eq(tenantPaymentMethodsTable.tenantId, tenantId),
      eq(tenantPaymentMethodsTable.paymentMethodCode, code),
    ));
    return row ?? null;
  }

  async upsertTenantPaymentMethod(tenantId: number, code: PaymentMethodCode, values: typeof tenantPaymentMethodsTable.$inferInsert) {
    const existing = await this.getTenantPaymentMethod(tenantId, code);
    if (existing) {
      const [updated] = await db.update(tenantPaymentMethodsTable)
        .set(values)
        .where(eq(tenantPaymentMethodsTable.id, existing.id))
        .returning();
      return updated;
    }

    const [created] = await db.insert(tenantPaymentMethodsTable).values(values).returning();
    return created;
  }

  async insertMissingTenantMethodRows(tenantId: number, codes: PaymentMethodCode[]) {
    const existing = await this.listTenantPaymentMethods(tenantId);
    const existingCodes = new Set(existing.map((row) => row.paymentMethodCode as PaymentMethodCode));
    const missing = codes.filter((code) => !existingCodes.has(code));
    if (missing.length === 0) return;

    await db.insert(tenantPaymentMethodsTable).values(
      missing.map((code) => ({
        tenantId,
        paymentMethodCode: code,
        isActive: false,
        accountNumber: null,
        accountName: null,
        instructionsAr: null,
        instructionsEn: null,
        metadata: {},
        updatedBy: null,
      })),
    );
  }

  async listMethodTenants(code: PaymentMethodCode) {
    const rows = await db.select({
      tenantId: tenantPaymentMethodsTable.tenantId,
      tenantName: tenantsTable.name,
      isActive: tenantPaymentMethodsTable.isActive,
      updatedAt: tenantPaymentMethodsTable.updatedAt,
    })
      .from(tenantPaymentMethodsTable)
      .innerJoin(tenantsTable, eq(tenantPaymentMethodsTable.tenantId, tenantsTable.id))
      .where(eq(tenantPaymentMethodsTable.paymentMethodCode, code));
    return rows;
  }

  async listTenantsByIds(tenantIds: number[]) {
    if (tenantIds.length === 0) return [];
    return db.select().from(tenantsTable).where(inArray(tenantsTable.id, tenantIds));
  }

  async getTenantById(tenantId: number) {
    const [tenant] = await db.select().from(tenantsTable).where(eq(tenantsTable.id, tenantId));
    return tenant ?? null;
  }

  async getUserById(userId: number) {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    return user ?? null;
  }

  async listPaymentMethodAuditLogs(tenantId?: number | null) {
    if (tenantId) {
      return db.select().from(paymentMethodAuditLogsTable).where(eq(paymentMethodAuditLogsTable.tenantId, tenantId));
    }
    return db.select().from(paymentMethodAuditLogsTable);
  }

  async getLatestTenantMethodAuditLog(tenantId: number, code: PaymentMethodCode) {
    const [log] = await db.select().from(paymentMethodAuditLogsTable)
      .where(and(
        eq(paymentMethodAuditLogsTable.tenantId, tenantId),
        eq(paymentMethodAuditLogsTable.paymentMethodCode, code),
      ))
      .orderBy(desc(paymentMethodAuditLogsTable.createdAt));
    return log ?? null;
  }
}

export const paymentMethodsRepository = new PaymentMethodsRepository();
