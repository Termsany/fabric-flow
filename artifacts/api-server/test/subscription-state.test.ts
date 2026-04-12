import test from "node:test";
import assert from "node:assert/strict";
import { buildSubscriptionStatusSummary } from "../src/lib/subscription-state";

test("buildSubscriptionStatusSummary marks active subscriptions clearly", () => {
  const nextMonth = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const summary = buildSubscriptionStatusSummary({
    billingStatus: "active",
    subscriptionEndsAt: nextMonth,
    isActive: true,
    lastInvoiceStatus: "paid",
  });

  assert.deepEqual(summary, {
    state: "active",
    severity: "success",
    hasAccess: true,
    needsAttention: false,
    isEndingSoon: false,
    nextRelevantAt: nextMonth.toISOString(),
    nextRelevantType: "renewal",
    lastInvoiceStatus: "paid",
  });
});

test("buildSubscriptionStatusSummary detects scheduled cancellation from cancel-at-period-end", () => {
  const inThreeDays = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  const summary = buildSubscriptionStatusSummary({
    billingStatus: "active",
    cancelAtPeriodEnd: true,
    currentPeriodEnd: inThreeDays,
    isActive: true,
  });

  assert.equal(summary.state, "scheduled_cancel");
  assert.equal(summary.severity, "warning");
  assert.equal(summary.isEndingSoon, true);
  assert.equal(summary.nextRelevantType, "cancellation");
});

test("buildSubscriptionStatusSummary flags payment problems as needing attention", () => {
  const summary = buildSubscriptionStatusSummary({
    billingStatus: "past_due",
    subscriptionEndsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    isActive: false,
    lastInvoiceStatus: "payment_failed",
  });

  assert.equal(summary.state, "past_due");
  assert.equal(summary.severity, "danger");
  assert.equal(summary.hasAccess, false);
  assert.equal(summary.needsAttention, true);
  assert.equal(summary.lastInvoiceStatus, "payment_failed");
});
