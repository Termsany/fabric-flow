import test from "node:test";
import assert from "node:assert/strict";
import { GetBillingSubscriptionResponse } from "@workspace/api-zod";

test("billing subscription schema accepts explicit subscription state visibility fields", () => {
  const parsed = GetBillingSubscriptionResponse.parse({
    tenantId: 4,
    currentPlan: "pro",
    subscriptionInterval: "monthly",
    billingStatus: "active",
    stripeCustomerId: "cus_123",
    stripeSubscriptionId: "sub_123",
    subscriptionEndsAt: "2026-05-01T00:00:00.000Z",
    trialEndsAt: null,
    lastInvoiceStatus: "paid",
    isActive: true,
    statusSummary: {
      state: "active",
      severity: "success",
      hasAccess: true,
      needsAttention: false,
      isEndingSoon: false,
      nextRelevantAt: "2026-05-01T00:00:00.000Z",
      nextRelevantType: "renewal",
      lastInvoiceStatus: "paid",
    },
    usage: {
      users: 3,
      warehouses: 1,
    },
    limits: {
      users: 20,
      warehouses: 5,
    },
    plans: [{
      key: "pro",
      name: "Pro",
      monthlyPriceId: "price_monthly",
      yearlyPriceId: "price_yearly",
      features: ["QC", "Dyeing"],
    }],
    manualPayment: {
      amount: 149,
      amountUsd: 149,
      localAmountEgp: 7450,
      baseCurrency: "USD",
      localCurrency: "EGP",
      usdExchangeRate: 50,
      interval: "monthly",
      instructions: {
        currency: "EGP",
        instapay: {
          account: "instapay@fabric",
          note: "Transfer full amount",
        },
        vodafoneCash: {
          number: "01000000000",
          note: "Send payment proof",
        },
      },
      methods: [{
        method: "instapay",
        accountNumber: "instapay@fabric",
        accountName: "Fabric Flow",
        instructionsAr: "حوّل المبلغ الكامل",
      }],
    },
  });

  assert.equal(parsed.statusSummary.state, "active");
  assert.equal(parsed.manualPayment.methods.length, 1);
  assert.equal(parsed.manualPayment.baseCurrency, "USD");
});
