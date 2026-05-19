import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  projects,
  rankTrackingConfigs,
  rankTrackingKeywords,
} from "@/db/app.schema";
import { member, organization, user } from "@/db/better-auth-schema";
import { weeklyReportSubscriptions } from "@/db/report.schema";

async function getSubscription(organizationId: string) {
  return db.query.weeklyReportSubscriptions.findFirst({
    where: eq(weeklyReportSubscriptions.organizationId, organizationId),
  });
}

async function setSubscriptionEnabled(organizationId: string, enabled: boolean) {
  await db
    .insert(weeklyReportSubscriptions)
    .values({ organizationId, enabled })
    .onConflictDoUpdate({
      target: weeklyReportSubscriptions.organizationId,
      set: { enabled },
    });
}

async function markReportSent(organizationId: string, sentAtIso: string) {
  await db
    .insert(weeklyReportSubscriptions)
    .values({
      organizationId,
      enabled: true,
      lastSentAt: sentAtIso,
    })
    .onConflictDoUpdate({
      target: weeklyReportSubscriptions.organizationId,
      set: { lastSentAt: sentAtIso },
    });
}

async function listOrganizationIdsDueForWeeklyReports() {
  const rows = await db
    .selectDistinct({ organizationId: projects.organizationId })
    .from(projects)
    .innerJoin(
      rankTrackingConfigs,
      eq(rankTrackingConfigs.projectId, projects.id),
    )
    .innerJoin(
      rankTrackingKeywords,
      eq(rankTrackingKeywords.configId, rankTrackingConfigs.id),
    )
    .innerJoin(
      weeklyReportSubscriptions,
      eq(weeklyReportSubscriptions.organizationId, projects.organizationId),
    )
    .where(
      and(
        eq(rankTrackingConfigs.isActive, true),
        eq(weeklyReportSubscriptions.enabled, true),
      ),
    );

  return rows.map((row) => row.organizationId);
}

async function getOrganizationById(organizationId: string) {
  return db.query.organization.findFirst({
    where: eq(organization.id, organizationId),
  });
}

async function getMemberEmailsForOrganization(organizationId: string) {
  const rows = await db
    .select({
      email: user.email,
      name: user.name,
    })
    .from(member)
    .innerJoin(user, eq(member.userId, user.id))
    .where(eq(member.organizationId, organizationId));

  const seen = new Set<string>();
  const recipients: { email: string; name: string | null }[] = [];

  for (const row of rows) {
    const email = row.email.trim().toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);
    recipients.push({ email: row.email, name: row.name });
  }

  return recipients;
}

async function listProjectsWithRankTracking(organizationId: string) {
  return db
    .select({
      projectId: projects.id,
      projectName: projects.name,
      configId: rankTrackingConfigs.id,
      domain: rankTrackingConfigs.domain,
    })
    .from(projects)
    .innerJoin(
      rankTrackingConfigs,
      eq(rankTrackingConfigs.projectId, projects.id),
    )
    .where(
      and(
        eq(projects.organizationId, organizationId),
        eq(rankTrackingConfigs.isActive, true),
      ),
    );
}

export const ReportRepository = {
  getSubscription,
  setSubscriptionEnabled,
  markReportSent,
  listOrganizationIdsDueForWeeklyReports,
  getOrganizationById,
  getMemberEmailsForOrganization,
  listProjectsWithRankTracking,
} as const;
