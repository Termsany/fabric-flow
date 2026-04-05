import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";

export const dyeingOrdersTable = pgTable("dyeing_orders", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  orderNumber: text("order_number").notNull(),
  dyehouseName: text("dyehouse_name").notNull(),
  targetColor: text("target_color").notNull(),
  targetShade: text("target_shade"),
  status: text("status").notNull().default("PENDING"), // PENDING, SENT, IN_PROGRESS, COMPLETED, CANCELLED
  sentAt: timestamp("sent_at", { withTimezone: true }),
  receivedAt: timestamp("received_at", { withTimezone: true }),
  notes: text("notes"),
  rollIds: integer("roll_ids").array().notNull().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertDyeingOrderSchema = createInsertSchema(dyeingOrdersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDyeingOrder = z.infer<typeof insertDyeingOrderSchema>;
export type DyeingOrder = typeof dyeingOrdersTable.$inferSelect;
