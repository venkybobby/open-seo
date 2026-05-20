import type { BillingCustomerContext } from "@/server/billing/subscription";
import { ProjectService } from "@/server/features/projects/services/ProjectService";
import { TenantRepository } from "@/server/features/tenants/repositories/TenantRepository";
import {
  buildMcpBillingCustomerInput,
  requireMcpToolAuthContext,
  type ToolExtra,
} from "@/server/mcp/context";

type ProjectScopedArgs = {
  projectId: string;
};

async function requireProjectAccess(_extra: ToolExtra, projectId: string) {
  const { baseUrl, ...auth } = requireMcpToolAuthContext(_extra);

  // This lookup enforces that the project belongs to the authenticated org.
  await ProjectService.getProjectForOrganization(
    auth.organizationId,
    projectId,
  );

  const tenant = await TenantRepository.getTenantBrandingForOrganization(
    auth.organizationId,
  );

  const billing: BillingCustomerContext = {
    ...buildMcpBillingCustomerInput(auth, projectId),
    tenant,
  };

  return {
    auth,
    baseUrl,
    billing,
  };
}

type McpProjectAuthContext = Awaited<ReturnType<typeof requireProjectAccess>>;

export function withMcpProjectAuth<TArgs extends ProjectScopedArgs, TResult>(
  handler: (
    args: TArgs,
    context: McpProjectAuthContext,
  ) => Promise<TResult> | TResult,
) {
  return async (args: TArgs, extra: ToolExtra) => {
    const context = await requireProjectAccess(extra, args.projectId);
    return handler(args, context);
  };
}
