import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { fabricRollsTable } from "./fabric-rolls";
import { usersTable } from "./users";
import { qcResultSchema } from "./domain-constraints";

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
}, (table) => ({
  qcReportsTenantIdx: index("qc_reports_tenant_id_idx").on(table.tenantId),
  qcReportsFabricRollIdx: index("qc_reports_fabric_roll_id_idx").on(table.fabricRollId),
}));

export const insertQcReportSchema = createInsertSchema(qcReportsTable)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    result: qcResultSchema,
  });
export type InsertQcReport = z.infer<typeof insertQcReportSchema>;
export type QcReport = typeof qcReportsTable.$inferSelect;
