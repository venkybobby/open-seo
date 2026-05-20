import StripeClient from "stripe";
import { tenantPlans, type TenantPlan } from "@/db/tenant.schema";
import { env } from "cloudflare:workers";

export function isStripePlatformBillingEnabled() {
  const key = getOptionalEnv("STRIPE_SECRET_KEY");
  return Boolean(key);
}

function getOptionalEnv(name: string) {
  const value: unknown = Reflect.get(env, name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function getRequiredEnv(name: string) {
  const value = getOptionalEnv(name);
  if (!value) {
    throw new Error(`${name} is required for Stripe platform billing`);
  }
  return value;
}

export function getStripeClient() {
  return new StripeClient(getRequiredEnv("STRIPE_SECRET_KEY"), {
    httpClient: StripeClient.createFetchHttpClient(),
  });
}

const PLAN_PRICE_ENV = {
  freelancer: "STRIPE_PRICE_FREELANCER",
  agency_starter: "STRIPE_PRICE_AGENCY_STARTER",
  agency_pro: "STRIPE_PRICE_AGENCY_PRO",
  enterprise: "STRIPE_PRICE_ENTERPRISE",
} satisfies Record<TenantPlan, string>;

export function getStripePriceIdForPlan(plan: TenantPlan) {
  const envName = PLAN_PRICE_ENV[plan];
  const priceId = getOptionalEnv(envName);
  if (!priceId) {
    throw new Error(`${envName} is not configured`);
  }
  return priceId;
}

export function resolveTenantPlanFromPriceId(
  priceId: string,
): TenantPlan | null {
  for (const plan of tenantPlans) {
    const configured = getOptionalEnv(PLAN_PRICE_ENV[plan]);
    if (configured === priceId) {
      return plan;
    }
  }
  return null;
}

export function constructStripeWebhookEvent(
  payload: string,
  signature: string | null,
) {
  const secret = getRequiredEnv("STRIPE_WEBHOOK_SECRET");
  if (!signature) {
    throw new Error("Missing Stripe signature header");
  }
  return getStripeClient().webhooks.constructEvent(payload, signature, secret);
}
