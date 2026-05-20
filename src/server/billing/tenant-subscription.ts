import { eq } from "drizzle-orm";
import type { Stripe as StripeNamespace } from "stripe";
import { db } from "@/db";
import {
  organizationTenants,
  tenantPlans,
  tenants,
  type TenantPlan,
} from "@/db/tenant.schema";
import {
  getStripeClient,
  getStripePriceIdForPlan,
  isStripePlatformBillingEnabled,
  resolveTenantPlanFromPriceId,
} from "@/server/billing/stripe";
import { AppError } from "@/server/lib/errors";
import { env } from "cloudflare:workers";

function getOptionalEnv(name: string) {
  const value: unknown = Reflect.get(env, name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

function getAppPublicUrl() {
  return (
    getOptionalEnv("APP_PUBLIC_URL") ??
    getOptionalEnv("BETTER_AUTH_URL") ??
    "http://localhost:3001"
  ).replace(/\/+$/, "");
}

const ACTIVE_SUBSCRIPTION_STATUSES = new Set([
  "active",
  "trialing",
]);

export async function tenantHasActivePlatformPlan(tenantId: string) {
  if (!isStripePlatformBillingEnabled()) {
    return true;
  }

  if (tenantId === "default") {
    return true;
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, tenantId),
  });

  if (!tenant || tenant.status !== "active") {
    return false;
  }

  const status = tenant.subscriptionStatus?.toLowerCase() ?? null;
  if (status && ACTIVE_SUBSCRIPTION_STATUSES.has(status)) {
    return true;
  }

  return false;
}

export async function assertTenantPlatformPlan(tenantId: string) {
  const active = await tenantHasActivePlatformPlan(tenantId);
  if (!active) {
    throw new AppError(
      "PAYMENT_REQUIRED",
      "An active agency platform subscription is required",
    );
  }
}

export async function getOrCreateStripeCustomerForTenant(input: {
  tenantId: string;
  email: string;
  name: string;
}) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });

  if (!tenant) {
    throw new AppError("NOT_FOUND", "Tenant not found");
  }

  if (tenant.stripeCustomerId) {
    return tenant.stripeCustomerId;
  }

  const stripe = getStripeClient();
  const customer = await stripe.customers.create({
    email: input.email,
    name: input.name,
    metadata: {
      tenant_id: input.tenantId,
    },
  });

  await db
    .update(tenants)
    .set({
      stripeCustomerId: customer.id,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, input.tenantId));

  return customer.id;
}

export async function createPlatformCheckoutSession(input: {
  tenantId: string;
  plan: TenantPlan;
  email: string;
  organizationId: string;
}) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });

  const customerId = await getOrCreateStripeCustomerForTenant({
    tenantId: input.tenantId,
    email: input.email,
    name: tenant?.agencyName ?? input.tenantId,
  });

  const stripe = getStripeClient();
  const priceId = getStripePriceIdForPlan(input.plan);
  const baseUrl = getAppPublicUrl();

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/billing?platform=success`,
    cancel_url: `${baseUrl}/billing?platform=canceled`,
    subscription_data: {
      metadata: {
        tenant_id: input.tenantId,
        organization_id: input.organizationId,
      },
    },
    metadata: {
      tenant_id: input.tenantId,
      organization_id: input.organizationId,
      plan: input.plan,
    },
  });

  if (!session.url) {
    throw new AppError("INTERNAL_ERROR", "Stripe checkout URL missing");
  }

  return { url: session.url };
}

export async function createPlatformBillingPortalSession(input: {
  tenantId: string;
}) {
  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, input.tenantId),
  });

  if (!tenant?.stripeCustomerId) {
    throw new AppError(
      "VALIDATION_ERROR",
      "No Stripe customer for this agency yet",
    );
  }

  const stripe = getStripeClient();
  const session = await stripe.billingPortal.sessions.create({
    customer: tenant.stripeCustomerId,
    return_url: `${getAppPublicUrl()}/billing`,
  });

  return { url: session.url };
}

async function updateTenantSubscriptionState(
  tenantId: string,
  values: {
    plan?: TenantPlan;
    stripeCustomerId?: string | null;
    stripeSubscriptionId?: string | null;
    subscriptionStatus?: string | null;
    status?: "active" | "suspended";
  },
) {
  await db
    .update(tenants)
    .set({
      ...values,
      updatedAt: new Date().toISOString(),
    })
    .where(eq(tenants.id, tenantId));
}

function planFromSubscription(
  subscription: StripeNamespace.Subscription,
): TenantPlan | null {
  const priceId = subscription.items.data[0]?.price?.id;
  if (!priceId) return null;
  return resolveTenantPlanFromPriceId(priceId);
}

export async function syncTenantFromStripeSubscription(
  subscription: StripeNamespace.Subscription,
) {
  const customer = subscription.customer;
  const customerMetadataTenantId =
    typeof customer === "string" || !customer || customer.deleted
      ? null
      : (customer.metadata?.tenant_id ?? null);

  const tenantId =
    subscription.metadata?.tenant_id ?? customerMetadataTenantId;

  if (!tenantId) {
    console.warn("[stripe] Subscription missing tenant_id metadata");
    return;
  }

  const plan = planFromSubscription(subscription);
  const status = subscription.status;
  const isActive = ACTIVE_SUBSCRIPTION_STATUSES.has(status);

  await updateTenantSubscriptionState(tenantId, {
    plan: plan ?? undefined,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId:
      typeof subscription.customer === "string"
        ? subscription.customer
        : subscription.customer?.id,
    subscriptionStatus: status,
    status: isActive ? "active" : "suspended",
  });
}

function isTenantPlan(value: string): value is TenantPlan {
  return (tenantPlans as readonly string[]).includes(value);
}

function parsePlanMetadata(value: string | undefined): TenantPlan | undefined {
  if (!value) return undefined;
  return isTenantPlan(value) ? value : undefined;
}

export async function handleStripeCheckoutSessionCompleted(
  session: StripeNamespace.Checkout.Session,
) {
  const tenantId = session.metadata?.tenant_id;
  if (!tenantId) return;

  const plan = parsePlanMetadata(session.metadata?.plan);
  const subscriptionId =
    typeof session.subscription === "string"
      ? session.subscription
      : session.subscription?.id;

  await updateTenantSubscriptionState(tenantId, {
    plan,
    stripeCustomerId:
      typeof session.customer === "string"
        ? session.customer
        : session.customer?.id,
    stripeSubscriptionId: subscriptionId ?? null,
    subscriptionStatus: "active",
    status: "active",
  });

  if (subscriptionId) {
    const stripe = getStripeClient();
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    await syncTenantFromStripeSubscription(subscription);
  }
}

export async function countProjectsForTenant(tenantId: string) {
  const { projects } = await import("@/db/app.schema");
  const { count } = await import("drizzle-orm");

  const [result] = await db
    .select({ value: count() })
    .from(projects)
    .innerJoin(
      organizationTenants,
      eq(projects.organizationId, organizationTenants.organizationId),
    )
    .where(eq(organizationTenants.tenantId, tenantId));

  return result?.value ?? 0;
}

export async function assertTenantProjectLimit(tenantId: string, plan: TenantPlan) {
  const { TENANT_PLAN_LIMITS } = await import("@/shared/billing");
  const limit = TENANT_PLAN_LIMITS[plan].maxProjects;
  if (limit == null) return;

  const current = await countProjectsForTenant(tenantId);
  if (current >= limit) {
    throw new AppError(
      "PAYMENT_REQUIRED",
      `Your ${TENANT_PLAN_LIMITS[plan].label} plan supports up to ${limit} client projects. Upgrade to add more.`,
    );
  }
}
