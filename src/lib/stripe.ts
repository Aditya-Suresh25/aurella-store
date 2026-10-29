import "server-only";

import Stripe from "stripe";

export function getStripe() {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) throw new Error("STRIPE_SECRET_KEY is required to use checkout.");
  if (
    !secretKey.startsWith("sk_test_") &&
    !secretKey.startsWith("rk_test_") &&
    !secretKey.startsWith("rkcs_test_")
  ) {
    throw new Error("This checkout demonstration only accepts Stripe test keys.");
  }
  return new Stripe(secretKey);
}
