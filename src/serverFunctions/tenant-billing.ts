import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { tenantPlans } from "@/db/tenant.schema";
import {
  countProjectsForTenant,
  createPlatformBillingPortalSession,
  createPlatformCheckoutSession,
  tenantHasActivePlatformPlan,
} from "@/server/billing/tenant-subscription";
import { isStripePlatformBillingEnabled } from "@/server/billing/stripe";
import { TENANT_PLAN_LIMITS } from "@/shared/billing";
import { requireAuthenticatedContext } from "@/serverFunctions/middleware";

export const getPlatformBillingStatus = createServerFn({ method: "GET" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    const { tenant } = context;
    const projectCount = await countProjectsForTenant(tenant.tenantId);
    const limits = TENANT_PLAN_LIMITS[tenant.plan];

    return {
      stripeEnabled: isStripePlatformBillingEnabled(),
      tenantId: tenant.tenantId,
      plan: tenant.plan,
      planLabel: limits.label,
      priceLabel: limits.priceLabel,
      subscriptionStatus: tenant.subscriptionStatus,
      platformActive: await tenantHasActivePlatformPlan(tenant.tenantId),
      projectCount,
      maxProjects: limits.maxProjects,
      isDefaultTenant: tenant.tenantId === "default",
    };
  });

export const createPlatformCheckout = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .inputValidator((data: unknown) =>
    z.object({ plan: z.enum(tenantPlans) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    if (!isStripePlatformBillingEnabled()) {
      throw new Error("Stripe platform billing is not configured");
    }

    return createPlatformCheckoutSession({
      tenantId: context.tenant.tenantId,
      plan: data.plan,
      email: context.userEmail,
      organizationId: context.organizationId,
    });
  });

export const openPlatformBillingPortal = createServerFn({ method: "POST" })
  .middleware(requireAuthenticatedContext)
  .handler(async ({ context }) => {
    if (!isStripePlatformBillingEnabled()) {
      throw new Error("Stripe platform billing is not configured");
    }

    return createPlatformBillingPortalSession({
      tenantId: context.tenant.tenantId,
    });
  });
