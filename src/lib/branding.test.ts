import { describe, expect, it } from "vitest";
import {
  brandingCssVariables,
  defaultTenantBranding,
  tenantRowToBranding,
} from "@/lib/branding";

describe("branding", () => {
  it("maps tenant rows to branding", () => {
    const branding = tenantRowToBranding({
      id: "t1",
      slug: "acme",
      agencyName: "Acme SEO",
      logoUrl: "https://cdn.example/logo.png",
      primaryColor: "#22c55e",
      customDomain: null,
      stripeCustomerId: null,
      stripeSubscriptionId: null,
      subscriptionStatus: "active",
      plan: "agency_starter",
      dataforseoKeyEncrypted: null,
      status: "active",
      createdAt: "2026-01-01",
      updatedAt: "2026-01-01",
    });

    expect(branding.agencyName).toBe("Acme SEO");
    expect(brandingCssVariables(branding)).toEqual({
      "--tenant-primary": "#22c55e",
      "--color-primary": "#22c55e",
    });
  });

  it("uses no css overrides for default branding", () => {
    expect(brandingCssVariables(defaultTenantBranding)).toEqual({});
  });
});
