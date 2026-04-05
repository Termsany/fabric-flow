import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { fabricRollsTable } from "./fabric-rolls";
import { usersTable } from "./users";

export const qcReportsTable = pgTable("qc_reports", {
  id: serial("id").primaryKey(),
  tenantId: integer("tenant_id").notNull().references(() => tenantsTable.id),
  fabricRollId: integer("fabric_roll_id").notNull().references(() => fabricRollsTable.id),
  inspectedById: integer("inspected_by_id").notNull().references(() => usersTable.id),
  result: text("result").notNull(), // PASS, FAIL, SECOND
  defects: text("defects"),
  defectCount: integer("defect_count").notNull().default(0),
  images: text("images").array().notNull().default([]),
  notes: text("notes"),
  inspectedAt: timestamp("inspected_at", { withTimezone: true }).notNull().defaultNow(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertQcReportSchema = createInsertSchema(qcReportsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertQcReport = z.infer<typeof insertQcReportSchema>;
export type QcReport = typeof qcReportsTable.$inferSelect;
