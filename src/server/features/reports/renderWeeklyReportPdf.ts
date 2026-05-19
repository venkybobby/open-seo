import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import type { WeeklyReportData } from "@/server/features/reports/weeklyReportData";

const PAGE_WIDTH = 612;
const PAGE_HEIGHT = 792;
const MARGIN = 48;
const LINE_HEIGHT = 14;

export async function renderWeeklyReportPdf(
  report: WeeklyReportData,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const brandRgb = rgb(0.09, 0.64, 0.29);

  let page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let y = PAGE_HEIGHT - MARGIN;

  function addPage() {
    page = doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    y = PAGE_HEIGHT - MARGIN;
  }

  function drawLine(
    text: string,
    options?: { size?: number; font?: typeof regular; color?: ReturnType<typeof rgb> },
  ) {
    const size = options?.size ?? 11;
    const font = options?.font ?? regular;
    const color = options?.color ?? rgb(0.1, 0.1, 0.1);

    if (y < MARGIN + LINE_HEIGHT) {
      addPage();
    }

    page.drawText(text, {
      x: MARGIN,
      y,
      size,
      font,
      color,
      maxWidth: PAGE_WIDTH - MARGIN * 2,
    });
    y -= LINE_HEIGHT + (size > 11 ? 4 : 2);
  }

  drawLine(report.branding.agencyName, {
    size: 10,
    color: brandRgb,
    font: bold,
  });
  drawLine("Weekly SEO report", { size: 18, font: bold });
  drawLine(`${report.organizationName} · ${report.periodLabel}`, {
    size: 11,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 8;

  for (const project of report.projects) {
    drawLine(project.projectName, { size: 14, font: bold });
    for (const domain of project.domains) {
      drawLine(domain.domain, { size: 12, font: bold });
      drawLine(
        `${domain.summary.keywordsTracked} keywords · Top 3: ${domain.summary.top3} · Top 10: ${domain.summary.top10} · Improved: ${domain.summary.improved} · Declined: ${domain.summary.declined}`,
        { size: 10, color: rgb(0.35, 0.35, 0.35) },
      );

      for (const mover of domain.movers.slice(0, 8)) {
        const change =
          mover.change == null
            ? ""
            : mover.change > 0
              ? ` (+${mover.change})`
              : ` (${mover.change})`;
        drawLine(
          `• ${mover.keyword} — pos ${mover.position ?? "—"}${change}`,
          { size: 10 },
        );
      }

      y -= 6;
    }
  }

  drawLine(`Dashboard: ${report.dashboardUrl}`, {
    size: 10,
    color: rgb(0.2, 0.35, 0.55),
  });

  return doc.save();
}
