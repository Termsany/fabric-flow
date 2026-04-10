import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";
import { salesOrderStatusSchema } from "./domain-constraints";

export const salesOrdersTable = pgTable("sales_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  orderNumber: text("order_number").notNull(),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  status: text("status").notNull().default("DRAFT"), // DRAFT, CONFIRMED, INVOICED, DELIVERED, CANCELLED
  totalAmount: real("total_amount").notNull().default(0),
  rollIds: integer("roll_ids").array().notNull().default([]),
  invoiceNumber: text("invoice_number"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  salesOrdersTenantIdx: index("sales_orders_tenant_id_idx").on(table.tenantId),
  salesOrdersCustomerIdx: index("sales_orders_customer_id_idx").on(table.customerId),
}));

export const insertSalesOrderSchema = createInsertSchema(salesOrdersTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    orderNumber: z.string().trim().min(1).max(120),
    status: salesOrderStatusSchema.default("DRAFT"),
  });
export type InsertSalesOrder = z.infer<typeof insertSalesOrderSchema>;
export type SalesOrder = typeof salesOrdersTable.$inferSelect;
