import type { TenantPlan } from "@/db/tenant.schema";

export const BILLING_ROUTE = "/billing";
export const SUBSCRIBE_ROUTE = "/subscribe";
export const PLATFORM_BILLING_ROUTE = "/billing#platform";

export const AUTUMN_PAID_PLAN_ID = "base-plan";
export const AUTUMN_SEO_DATA_TOP_UP_PLAN_ID = "credit-top-up";
export const AUTUMN_PAID_PLAN_FEATURE_ID = "paid_plan";
export const AUTUMN_SEO_DATA_BALANCE_FEATURE_ID = "usage_credits";
export const AUTUMN_SEO_DATA_TOPUP_BALANCE_FEATURE_ID = "topup_credits";
export const AUTUMN_SEO_DATA_CREDITS_PER_USD = 1000;
/** Default hosted markup when tenant plan is unknown (28%). */
export const SEO_DATA_COST_MARKUP = 1.28;
export const LOW_CREDITS_THRESHOLD_USD = 0.25;

export const TENANT_PLAN_LIMITS: Record<
  TenantPlan,
  { maxProjects: number | null; label: string; priceLabel: string }
> = {
  freelancer: {
    maxProjects: 5,
    label: "Freelancer",
    priceLabel: "$49/mo",
  },
  agency_starter: {
    maxProjects: 25,
    label: "Agency Starter",
    priceLabel: "$149/mo",
  },
  agency_pro: {
    maxProjects: null,
    label: "Agency Pro",
    priceLabel: "$399/mo",
  },
  enterprise: {
    maxProjects: null,
    label: "Enterprise",
    priceLabel: "Custom",
  },
};

/** Platform fee on raw DataForSEO USD (1 + margin%). */
export function getMarkupMultiplierForTenantPlan(plan: TenantPlan) {
  switch (plan) {
    case "freelancer":
      return 1.2;
    case "agency_starter":
      return 1.25;
    case "agency_pro":
      return 1.3;
    case "enterprise":
      return 1.3;
    default:
      return SEO_DATA_COST_MARKUP;
  }
}

export function applyTenantPlanMarkupUsd(rawUsd: number, plan: TenantPlan) {
  return roundUsdForBilling(rawUsd * getMarkupMultiplierForTenantPlan(plan));
}

export function roundUsdForBilling(value: number) {
  return Math.round(value * 100000) / 100000;
}

export function autumnSeoDataCreditsToUsd(credits: number) {
  return credits / AUTUMN_SEO_DATA_CREDITS_PER_USD;
}

/**
 * Convert a raw DataForSEO USD cost into the USD amount a hosted customer is
 * actually billed, applying the platform markup. Use this when displaying
 * cost estimates so the number matches what the user will be charged.
 *
 * Self-hosted deployments pay DataForSEO directly at the raw rate and should
 * show the raw number — gate at the call site with `isHostedClientAuthMode`.
 */
export function applyBillingMarkupUsd(rawUsd: number): number {
  return roundUsdForBilling(rawUsd * SEO_DATA_COST_MARKUP);
}
