import { createServerFn } from "@tanstack/react-start";
import { resolveTenantBranding } from "@/middleware/resolve-tenant";

/** Public branding config resolved from the request host (no auth required). */
export const getTenantBranding = createServerFn({ method: "GET" }).handler(
  async () => resolveTenantBranding(),
);
