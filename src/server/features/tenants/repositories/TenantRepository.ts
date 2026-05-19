import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationTenants, tenants } from "@/db/tenant.schema";
import {
  defaultTenantBranding,
  tenantRowToBranding,
  type TenantBranding,
} from "@/lib/branding";
import { organizationTenants } from "@/db/tenant.schema";
import { AppError } from "@/server/lib/errors";

const DEFAULT_TENANT_SLUG = "default";

function normalizeHost(host: string) {
  return host.split(":")[0]?.toLowerCase().trim() ?? "";
}

async function getBySlug(slug: string) {
  return db.query.tenants.findFirst({
    where: and(eq(tenants.slug, slug), eq(tenants.status, "active")),
  });
}

async function getByCustomDomain(domain: string) {
  return db.query.tenants.findFirst({
    where: and(eq(tenants.customDomain, domain), eq(tenants.status, "active")),
  });
}

async function getById(tenantId: string) {
  return db.query.tenants.findFirst({
    where: and(eq(tenants.id, tenantId), eq(tenants.status, "active")),
  });
}

async function resolveBrandingFromHost(
  hostHeader: string | null,
  options?: {
    platformDomain?: string | null;
    fallbackSlug?: string | null;
  },
): Promise<TenantBranding> {
  const host = normalizeHost(hostHeader ?? "");
  if (!host) {
    return resolveBrandingBySlug(options?.fallbackSlug ?? DEFAULT_TENANT_SLUG);
  }

  const byDomain = await getByCustomDomain(host);
  if (byDomain) {
    return tenantRowToBranding(byDomain);
  }

  const platformDomain = options?.platformDomain?.toLowerCase().trim();
  if (platformDomain && host.endsWith(`.${platformDomain}`)) {
    const subdomain = host.slice(0, -(platformDomain.length + 1));
    const slug = subdomain.split(".")[0];
    if (slug && slug !== "www") {
      const bySlug = await getBySlug(slug);
      if (bySlug) {
        return tenantRowToBranding(bySlug);
      }
    }
  }

  return resolveBrandingBySlug(options?.fallbackSlug ?? DEFAULT_TENANT_SLUG);
}

async function resolveBrandingBySlug(slug: string): Promise<TenantBranding> {
  const tenant = await getBySlug(slug);
  if (!tenant) {
    if (slug === DEFAULT_TENANT_SLUG) {
      return defaultTenantBranding;
    }
    throw new AppError("NOT_FOUND", "Tenant not found");
  }
  return tenantRowToBranding(tenant);
}

async function getOrganizationTenantId(organizationId: string) {
  const link = await db.query.organizationTenants.findFirst({
    where: eq(organizationTenants.organizationId, organizationId),
  });
  return link?.tenantId ?? null;
}

async function ensureOrganizationTenant(
  organizationId: string,
  tenantId: string,
) {
  const existingTenantId = await getOrganizationTenantId(organizationId);
  if (existingTenantId === tenantId) {
    return;
  }

  if (existingTenantId && existingTenantId !== tenantId) {
    throw new AppError(
      "FORBIDDEN",
      "Organization belongs to a different tenant",
    );
  }

  await db
    .insert(organizationTenants)
    .values({ organizationId, tenantId })
    .onConflictDoNothing();
}

async function assertOrganizationBelongsToTenant(
  organizationId: string,
  tenantId: string,
) {
  const linkedTenantId = await getOrganizationTenantId(organizationId);

  if (!linkedTenantId) {
    await ensureOrganizationTenant(organizationId, tenantId);
    return;
  }

  if (linkedTenantId !== tenantId) {
    throw new AppError(
      "FORBIDDEN",
      "Organization belongs to a different tenant",
    );
  }
}

async function getTenantBrandingForOrganization(organizationId: string) {
  const link = await db.query.organizationTenants.findFirst({
    where: eq(organizationTenants.organizationId, organizationId),
  });

  if (!link) {
    return defaultTenantBranding;
  }

  const tenant = await getById(link.tenantId);
  return tenant ? tenantRowToBranding(tenant) : defaultTenantBranding;
}

export const TenantRepository = {
  getBySlug,
  getByCustomDomain,
  getById,
  resolveBrandingFromHost,
  resolveBrandingBySlug,
  getOrganizationTenantId,
  ensureOrganizationTenant,
  assertOrganizationBelongsToTenant,
  getTenantBrandingForOrganization,
} as const;
