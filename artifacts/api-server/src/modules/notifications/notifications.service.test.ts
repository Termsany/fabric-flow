import test from "node:test";
import assert from "node:assert/strict";
import { buildOperationalAlertCandidates } from "./notifications.service";

test("buildOperationalAlertCandidates builds expected alerts for operational risks", () => {
  const now = new Date("2026-01-10T00:00:00.000Z");
  const candidates = buildOperationalAlertCandidates({
    tenantId: 7,
    now,
    stuckOrders: [{
      id: 11,
      orderNumber: "PO-11",
      createdAt: new Date("2025-12-25T00:00:00.000Z"),
    }],
    overdueInvoices: [{
      id: 22,
      invoiceNumber: "INV-22",
      status: "OVERDUE",
      dueAt: new Date("2026-01-05T00:00:00.000Z"),
    }],
    subscription: {
      id: 31,
      tenantId: 7,
      planId: 2,
      planPriceId: null,
      amount: 500,
      status: "active",
      paymentProvider: "stripe",
      paymentMethodCode: "card",
      startedAt: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodStart: new Date("2026-01-01T00:00:00.000Z"),
      currentPeriodEnd: new Date("2026-01-15T00:00:00.000Z"),
      trialEndsAt: new Date("2026-01-12T00:00:00.000Z"),
      cancelAtPeriodEnd: false,
      canceledAt: null,
      metadata: {},
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-01T00:00:00.000Z"),
    },
    warehouses: [{ id: 5, name: "Main Warehouse" }],
    stockByWarehouse: new Map([[5, 1]]),
    tenantBillingStatus: "past_due",
  });

  const types = candidates.map((candidate) => candidate.type);

  assert.ok(types.includes("production_delayed"));
  assert.ok(types.includes("unpaid_invoice"));
  assert.ok(types.includes("subscription_expiring"));
  assert.ok(types.includes("low_stock"));
  assert.ok(types.includes("subscription_unpaid"));
  assert.ok(types.includes("trial_ending"));
});

test("buildOperationalAlertCandidates stays quiet when there are no risks", () => {
  const candidates = buildOperationalAlertCandidates({
    tenantId: 2,
    now: new Date("2026-01-10T00:00:00.000Z"),
    stuckOrders: [],
    overdueInvoices: [],
    subscription: null,
    warehouses: [{ id: 4, name: "Spare" }],
    stockByWarehouse: new Map([[4, 10]]),
    tenantBillingStatus: "active",
  });

  assert.deepEqual(candidates, []);
});
