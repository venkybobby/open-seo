import { getRequest } from "@tanstack/react-start/server";
import type { TenantBranding } from "@/lib/branding";
import { TenantRepository } from "@/server/features/tenants/repositories/TenantRepository";
import { env } from "cloudflare:workers";

export async function resolveTenantBranding(
  headers?: Headers,
): Promise<TenantBranding> {
  const requestHeaders = headers ?? getRequest().headers;
  const host = requestHeaders.get("host");

  return TenantRepository.resolveBrandingFromHost(host, {
    platformDomain: env.TENANT_PLATFORM_DOMAIN,
    fallbackSlug: env.DEFAULT_TENANT_SLUG,
  });
}
