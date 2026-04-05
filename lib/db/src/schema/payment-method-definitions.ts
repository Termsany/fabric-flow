import { pgTable, text, serial, timestamp, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const paymentMethodDefinitionsTable = pgTable("payment_method_definitions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull(),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  category: text("category").notNull().default("manual"),
  isGloballyEnabled: boolean("is_globally_enabled").notNull().default(true),
  supportsManualReview: boolean("supports_manual_review").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  accountNumber: text("account_number"),
  accountName: text("account_name"),
  instructionsAr: text("instructions_ar"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => ({
  paymentMethodUnique: uniqueIndex("payment_method_definitions_code_unique").on(table.code),
  paymentMethodCodeIdx: index("payment_method_definitions_code_idx").on(table.code),
}));

export const insertPaymentMethodDefinitionSchema = createInsertSchema(paymentMethodDefinitionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertPaymentMethodDefinition = z.infer<typeof insertPaymentMethodDefinitionSchema>;
export type PaymentMethodDefinition = typeof paymentMethodDefinitionsTable.$inferSelect;
