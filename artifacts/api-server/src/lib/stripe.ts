import Stripe from "stripe";

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;

export function isStripeConfigured(): boolean {
  return Boolean(stripeSecretKey);
}

export const stripe = stripeSecretKey
  ? new Stripe(stripeSecretKey, {
      apiVersion: "2025-08-27.basil",
      typescript: true,
    })
  : null;
