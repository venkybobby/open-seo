import { describe, expect, it } from "vitest";
import {
  getMarkupMultiplierForTenantPlan,
  TENANT_PLAN_LIMITS,
} from "@/shared/billing";

describe("tenant plan billing", () => {
  it("applies plan-specific markup multipliers", () => {
    expect(getMarkupMultiplierForTenantPlan("freelancer")).toBe(1.2);
    expect(getMarkupMultiplierForTenantPlan("agency_starter")).toBe(1.25);
    expect(getMarkupMultiplierForTenantPlan("agency_pro")).toBe(1.3);
  });

  it("defines project limits per tier", () => {
    expect(TENANT_PLAN_LIMITS.freelancer.maxProjects).toBe(5);
    expect(TENANT_PLAN_LIMITS.agency_pro.maxProjects).toBeNull();
  });
});
