import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { salesOrdersTable } from "./sales-orders";
import { customersTable } from "./customers";
import { invoiceStatusSchema } from "./domain-constraints";

export const invoicesTable = pgTable("invoices", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  salesOrderId: integer("sales_order_id").notNull().references(() => salesOrdersTable.id),
  customerId: integer("customer_id").notNull().references(() => customersTable.id),
  invoiceNumber: text("invoice_number").notNull().unique(),
  amount: real("amount").notNull(),
  currency: text("currency").notNull().default("EGP"),
  status: text("status").notNull().default("ISSUED"), // ISSUED, PAID, OVERDUE, VOID
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  dueAt: timestamp("due_at", { withTimezone: true }),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  invoicesTenantIdx: index("invoices_tenant_id_idx").on(table.tenantId),
  invoicesSalesOrderIdx: index("invoices_sales_order_id_idx").on(table.salesOrderId),
  invoicesCustomerIdx: index("invoices_customer_id_idx").on(table.customerId),
}));

export const insertInvoiceSchema = createInsertSchema(invoicesTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    invoiceNumber: z.string().trim().min(1).max(120),
    status: invoiceStatusSchema.default("ISSUED"),
  });
export type InsertInvoice = z.infer<typeof insertInvoiceSchema>;
export type Invoice = typeof invoicesTable.$inferSelect;
