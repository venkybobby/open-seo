import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizationTenants, tenants } from "@/db/tenant.schema";
import {
  defaultTenantBranding,
  tenantRowToBranding,
  type TenantBranding,
} from "@/lib/branding";
import { getLatestResults } from "@/server/features/rank-tracking/services/rankTrackingResults";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import {
  pickTopMovers,
  summarizeRankRows,
  type RankDomainSummary,
  type RankMoverRow,
} from "@/server/features/reports/weeklyReportSummary";

export type WeeklyReportDomainSection = {
  domain: string;
  configId: string;
  summary: RankDomainSummary;
  movers: RankMoverRow[];
  lastCheckedAt: string | null;
};

export type WeeklyReportProjectSection = {
  projectId: string;
  projectName: string;
  domains: WeeklyReportDomainSection[];
};

export type WeeklyReportData = {
  organizationId: string;
  organizationName: string;
  branding: TenantBranding;
  periodLabel: string;
  generatedAt: string;
  projects: WeeklyReportProjectSection[];
  dashboardUrl: string;
};

function formatPeriodLabel(start: Date, end: Date) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${formatter.format(start)} – ${formatter.format(end)}`;
}

async function resolveBrandingForOrganization(
  organizationId: string,
): Promise<TenantBranding> {
  const link = await db.query.organizationTenants.findFirst({
    where: eq(organizationTenants.organizationId, organizationId),
  });

  if (!link) {
    return defaultTenantBranding;
  }

  const tenant = await db.query.tenants.findFirst({
    where: eq(tenants.id, link.tenantId),
  });

  return tenant ? tenantRowToBranding(tenant) : defaultTenantBranding;
}

export async function buildWeeklyReportData(input: {
  organizationId: string;
  appPublicUrl: string;
}): Promise<WeeklyReportData | null> {
  const organization = await ReportRepository.getOrganizationById(
    input.organizationId,
  );
  if (!organization) {
    return null;
  }

  const projectConfigs = await ReportRepository.listProjectsWithRankTracking(
    input.organizationId,
  );
  if (projectConfigs.length === 0) {
    return null;
  }

  const end = new Date();
  const start = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  const projectsMap = new Map<string, WeeklyReportProjectSection>();

  for (const row of projectConfigs) {
    const { rows, run } = await getLatestResults(
      row.configId,
      row.projectId,
      "7d",
    );
    if (rows.length === 0) continue;

    const domainSection: WeeklyReportDomainSection = {
      domain: row.domain,
      configId: row.configId,
      summary: summarizeRankRows(rows),
      movers: pickTopMovers(rows),
      lastCheckedAt: run?.lastCheckedAt ?? null,
    };

    const existing = projectsMap.get(row.projectId);
    if (existing) {
      existing.domains.push(domainSection);
      continue;
    }

    projectsMap.set(row.projectId, {
      projectId: row.projectId,
      projectName: row.projectName,
      domains: [domainSection],
    });
  }

  const projects = [...projectsMap.values()];
  if (projects.length === 0) {
    return null;
  }

  const branding = await resolveBrandingForOrganization(input.organizationId);
  const dashboardUrl = `${input.appPublicUrl.replace(/\/+$/, "")}/`;

  return {
    organizationId: input.organizationId,
    organizationName: organization.name,
    branding,
    periodLabel: formatPeriodLabel(start, end),
    generatedAt: end.toISOString(),
    projects,
    dashboardUrl,
  };
}
