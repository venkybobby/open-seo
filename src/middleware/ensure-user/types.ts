import type { TenantBranding } from "@/lib/branding";
import type { ProjectRepository } from "@/server/features/projects/repositories/ProjectRepository";

export type EnsuredProject = NonNullable<
  Awaited<ReturnType<typeof ProjectRepository.getProjectForOrganization>>
>;

export type EnsuredUserContext = {
  userId: string;
  userEmail: string;
  organizationId: string;
  tenant: TenantBranding;
  project?: EnsuredProject;
};
