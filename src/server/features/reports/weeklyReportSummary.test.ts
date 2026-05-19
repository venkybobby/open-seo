import { describe, expect, it } from "vitest";
import {
  pickTopMovers,
  summarizeRankRows,
} from "@/server/features/reports/weeklyReportSummary";
import type { RankTrackingRow } from "@/types/schemas/rank-tracking";

function row(
  keyword: string,
  desktop: { position: number | null; previous: number | null },
): RankTrackingRow {
  return {
    trackingKeywordId: keyword,
    keyword,
    searchVolume: 100,
    keywordDifficulty: 10,
    cpc: 1,
    desktop: {
      position: desktop.position,
      previousPosition: desktop.previous,
      rankingUrl: null,
      serpFeatures: [],
    },
    mobile: {
      position: null,
      previousPosition: null,
      rankingUrl: null,
      serpFeatures: [],
    },
  };
}

describe("weeklyReportSummary", () => {
  it("summarizes top positions and movement", () => {
    const summary = summarizeRankRows([
      row("alpha", { position: 2, previous: 5 }),
      row("beta", { position: 12, previous: 8 }),
      row("gamma", { position: null, previous: null }),
    ]);

    expect(summary.keywordsTracked).toBe(3);
    expect(summary.top3).toBe(1);
    expect(summary.top10).toBe(1);
    expect(summary.improved).toBe(1);
    expect(summary.declined).toBe(1);
  });

  it("picks largest movers first", () => {
    const movers = pickTopMovers([
      row("small", { position: 9, previous: 10 }),
      row("big", { position: 3, previous: 18 }),
    ]);

    expect(movers[0]?.keyword).toBe("big");
    expect(movers[0]?.change).toBe(15);
  });
});
