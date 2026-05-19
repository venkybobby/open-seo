import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import { isHostedServerAuthMode } from "@/server/lib/runtime-env";
import { customerHasPaidPlan } from "@/server/billing/subscription";
import { tenantHasActivePlatformPlan } from "@/server/billing/tenant-subscription";
import { TenantRepository } from "@/server/features/tenants/repositories/TenantRepository";

export async function enqueueWeeklyReports(env: Env) {
  if (!(await isHostedServerAuthMode())) {
    console.log("[weekly-report] Skipping — not in hosted auth mode");
    return;
  }

  const organizationIds =
    await ReportRepository.listOrganizationIdsDueForWeeklyReports();

  console.log(
    `[weekly-report] Enqueueing ${organizationIds.length} organization report(s)`,
  );

  for (const organizationId of organizationIds) {
    try {
      if (!(await customerHasPaidPlan(organizationId))) {
        console.log(
          `[weekly-report] Skipping ${organizationId} — no active paid plan`,
        );
        continue;
      }

      const tenantBranding =
        await TenantRepository.getTenantBrandingForOrganization(organizationId);
      if (!(await tenantHasActivePlatformPlan(tenantBranding.tenantId))) {
        console.log(
          `[weekly-report] Skipping ${organizationId} — tenant platform subscription inactive`,
        );
        continue;
      }

      const runId = crypto.randomUUID();
      await env.WEEKLY_REPORT_WORKFLOW.create({
        id: runId,
        params: { organizationId },
      });

      console.log(
        `[weekly-report] Started workflow ${runId} for ${organizationId}`,
      );
    } catch (error) {
      console.error(
        `[weekly-report] Failed to enqueue report for ${organizationId}:`,
        error,
      );
    }
  }
}
