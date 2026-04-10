import { pgTable, text, serial, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { usersTable } from "./users";
import { platformAdminsTable } from "./platform-admins";
import { paymentMethodSchema, paymentStatusSchema } from "./domain-constraints";

export const paymentsTable = pgTable("payments", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  status: text("status").notNull().default("pending"),
  referenceNumber: text("reference_number").notNull(),
  proofImageUrl: text("proof_image_url").notNull(),
  createdBy: integer("created_by").notNull().references(() => usersTable.id),
  reviewedBy: integer("reviewed_by").references(() => platformAdminsTable.id),
  reviewedAt: timestamp("reviewed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  paymentsTenantIdx: index("payments_tenant_id_idx").on(table.tenantId),
  paymentsCreatedByIdx: index("payments_created_by_idx").on(table.createdBy),
  paymentsReviewedByIdx: index("payments_reviewed_by_idx").on(table.reviewedBy),
}));

export const insertPaymentSchema = createInsertSchema(paymentsTable).omit({
  id: true,
  reviewedBy: true,
  reviewedAt: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  amount: z.number().positive(),
  method: paymentMethodSchema,
  status: paymentStatusSchema.default("pending"),
  referenceNumber: z.string().trim().min(1).max(200),
  proofImageUrl: z.string().trim().min(1).max(2048),
});
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type Payment = typeof paymentsTable.$inferSelect;
