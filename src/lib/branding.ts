import type { TenantPlan, tenants } from "@/db/tenant.schema";

export type TenantBranding = {
  tenantId: string;
  slug: string;
  agencyName: string;
  logoUrl: string | null;
  primaryColor: string | null;
  plan: TenantPlan;
  subscriptionStatus: string | null;
};

export const defaultTenantBranding: TenantBranding = {
  tenantId: "default",
  slug: "default",
  agencyName: "OpenSEO",
  logoUrl: null,
  primaryColor: null,
  plan: "agency_pro",
  subscriptionStatus: "active",
};

type TenantRow = typeof tenants.$inferSelect;

export function tenantRowToBranding(tenant: TenantRow): TenantBranding {
  return {
    tenantId: tenant.id,
    slug: tenant.slug,
    agencyName: tenant.agencyName,
    logoUrl: tenant.logoUrl,
    primaryColor: tenant.primaryColor,
    plan: tenant.plan,
    subscriptionStatus: tenant.subscriptionStatus,
  };
}

export function brandingCssVariables(
  branding: TenantBranding,
): Record<string, string> {
  const vars: Record<string, string> = {};

  if (branding.primaryColor) {
    vars["--tenant-primary"] = branding.primaryColor;
    vars["--color-primary"] = branding.primaryColor;
  }

  return vars;
}

export function applyBrandingToDocument(branding: TenantBranding) {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const vars = brandingCssVariables(branding);

  for (const [key, value] of Object.entries(vars)) {
    root.style.setProperty(key, value);
  }

  document.title = branding.agencyName;
}
