import type { WeeklyReportData } from "@/server/features/reports/weeklyReportData";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function formatPosition(value: number | null) {
  if (value == null) return "—";
  return String(value);
}

function formatChange(value: number | null) {
  if (value == null) return "—";
  if (value > 0) return `▲ ${value}`;
  if (value < 0) return `▼ ${Math.abs(value)}`;
  return "—";
}

export function renderWeeklyReportHtml(report: WeeklyReportData) {
  const brandColor = report.branding.primaryColor ?? "#16a34a";
  const brandName = escapeHtml(report.branding.agencyName);

  const projectSections = report.projects
    .map((project) => {
      const domainBlocks = project.domains
        .map((domain) => {
          const moverRows =
            domain.movers.length > 0
              ? domain.movers
                  .map(
                    (row) => `
              <tr>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(row.keyword)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatPosition(row.position)}</td>
                <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-align:right;">${formatChange(row.change)}</td>
              </tr>`,
                  )
                  .join("")
              : `<tr><td colspan="3" style="padding:12px;color:#6b7280;">No position changes this week.</td></tr>`;

          return `
          <div style="margin-top:24px;">
            <h3 style="margin:0 0 8px;font-size:16px;color:#111827;">${escapeHtml(domain.domain)}</h3>
            <p style="margin:0 0 12px;font-size:13px;color:#6b7280;">
              ${domain.summary.keywordsTracked} keywords · Top 3: ${domain.summary.top3} · Top 10: ${domain.summary.top10} ·
              Improved: ${domain.summary.improved} · Declined: ${domain.summary.declined}
              ${domain.summary.avgPosition != null ? ` · Avg position: ${domain.summary.avgPosition}` : ""}
            </p>
            <table style="width:100%;border-collapse:collapse;font-size:13px;">
              <thead>
                <tr style="background:#f9fafb;">
                  <th style="padding:8px 12px;text-align:left;color:#6b7280;">Keyword</th>
                  <th style="padding:8px 12px;text-align:right;color:#6b7280;">Position</th>
                  <th style="padding:8px 12px;text-align:right;color:#6b7280;">7d change</th>
                </tr>
              </thead>
              <tbody>${moverRows}</tbody>
            </table>
          </div>`;
        })
        .join("");

      return `
      <section style="margin-top:32px;">
        <h2 style="margin:0;font-size:18px;color:#111827;">${escapeHtml(project.projectName)}</h2>
        ${domainBlocks}
      </section>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html>
  <body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
    <div style="max-width:640px;margin:0 auto;padding:24px;">
      <div style="background:#ffffff;border-radius:12px;border:1px solid #e5e7eb;overflow:hidden;">
        <div style="padding:24px 24px 16px;border-bottom:4px solid ${brandColor};">
          ${report.branding.logoUrl ? `<img src="${escapeHtml(report.branding.logoUrl)}" alt="${brandName}" height="32" style="display:block;margin-bottom:12px;" />` : ""}
          <p style="margin:0;font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:${brandColor};">${brandName}</p>
          <h1 style="margin:8px 0 0;font-size:24px;line-height:1.2;">Weekly SEO report</h1>
          <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">${escapeHtml(report.organizationName)} · ${escapeHtml(report.periodLabel)}</p>
        </div>
        <div style="padding:24px;">
          <p style="margin:0 0 16px;font-size:14px;line-height:1.6;color:#374151;">
            Here is your rank tracking summary for the past 7 days. Full details are in your dashboard.
          </p>
          ${projectSections}
          <p style="margin:32px 0 0;">
            <a href="${escapeHtml(report.dashboardUrl)}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 18px;border-radius:8px;">
              Open dashboard
            </a>
          </p>
        </div>
      </div>
      <p style="margin:16px 0 0;font-size:11px;color:#9ca3af;text-align:center;">
        You receive this because weekly reports are enabled for your workspace.
        Turn them off in Settings.
      </p>
    </div>
  </body>
</html>`;
}
