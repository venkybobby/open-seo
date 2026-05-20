import type { TenantBranding } from "@/lib/branding";
import type { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";

export type EnsuredProject = NonNullable<
  Awaited<ReturnType<typeof ProjectRepository.getProjectForOrganization>>
>;

/**
 * Pre-tenant context returned by auth mode resolvers. `ensureUserMiddleware`
 * adds `tenant` (and optional `project`) afterwards to produce
 * `EnsuredUserContext`.
 */
export type ResolvedAuthContext = {
  userId: string;
  userEmail: string;
  organizationId: string;
};

export type EnsuredUserContext = ResolvedAuthContext & {
  tenant: TenantBranding;
  project?: EnsuredProject;
};
