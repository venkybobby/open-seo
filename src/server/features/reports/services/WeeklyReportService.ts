import { buildWeeklyReportData } from "@/server/features/reports/weeklyReportData";
import { renderWeeklyReportHtml } from "@/server/features/reports/renderWeeklyReportHtml";
import { renderWeeklyReportPdf } from "@/server/features/reports/renderWeeklyReportPdf";
import { ReportRepository } from "@/server/features/reports/repositories/ReportRepository";
import { sendWeeklyReportEmail } from "@/server/email/report-email";
import { env } from "cloudflare:workers";

function getAppPublicUrl() {
  const betterAuthUrl = getOptionalEnv("BETTER_AUTH_URL");
  if (betterAuthUrl) return betterAuthUrl;
  return getOptionalEnv("APP_PUBLIC_URL") ?? "https://app.openseo.so";
}

function getOptionalEnv(name: string) {
  const value: unknown = Reflect.get(env, name);
  const trimmed = typeof value === "string" ? value.trim() : "";
  return trimmed || null;
}

export async function deliverWeeklyReportForOrganization(organizationId: string) {
  const report = await buildWeeklyReportData({
    organizationId,
    appPublicUrl: getAppPublicUrl(),
  });

  if (!report) {
    console.log(
      `[weekly-report] No rank data for organization ${organizationId} — skipped`,
    );
    return { ok: false as const, reason: "no_data" as const };
  }

  const recipients = await ReportRepository.getMemberEmailsForOrganization(
    organizationId,
  );
  const emails = recipients.map((recipient) => recipient.email);

  if (emails.length === 0) {
    console.log(
      `[weekly-report] No member emails for organization ${organizationId} — skipped`,
    );
    return { ok: false as const, reason: "no_recipients" as const };
  }

  const html = renderWeeklyReportHtml(report);
  const pdfBytes = await renderWeeklyReportPdf(report);
  const periodSlug = report.periodLabel.replace(/[^\w]+/g, "-").toLowerCase();
  const pdfFilename = `seo-weekly-report-${periodSlug}.pdf`;
  const subject = `${report.branding.agencyName} weekly report — ${report.organizationName}`;

  await sendWeeklyReportEmail({
    to: emails,
    subject,
    html,
    pdfBytes,
    pdfFilename,
    fromName: report.branding.agencyName,
  });

  await ReportRepository.markReportSent(organizationId, report.generatedAt);

  console.log(
    `[weekly-report] Sent report for ${organizationId} to ${emails.length} recipient(s)`,
  );

  return { ok: true as const, recipientCount: emails.length };
}
