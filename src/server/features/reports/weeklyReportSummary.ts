import type { RankTrackingRow } from "@/types/schemas/rank-tracking";

export type RankDomainSummary = {
  keywordsTracked: number;
  top3: number;
  top10: number;
  improved: number;
  declined: number;
  unchanged: number;
  avgPosition: number | null;
};

export type RankMoverRow = {
  keyword: string;
  position: number | null;
  previousPosition: number | null;
  change: number | null;
  rankingUrl: string | null;
};

function bestPosition(row: RankTrackingRow): number | null {
  const positions = [row.desktop.position, row.mobile.position].filter(
    (value): value is number => value != null,
  );
  if (positions.length === 0) return null;
  return Math.min(...positions);
}

function bestPreviousPosition(row: RankTrackingRow): number | null {
  const positions = [
    row.desktop.previousPosition,
    row.mobile.previousPosition,
  ].filter((value): value is number => value != null);
  if (positions.length === 0) return null;
  return Math.min(...positions);
}

function primaryRankingUrl(row: RankTrackingRow): string | null {
  if (row.desktop.rankingUrl) return row.desktop.rankingUrl;
  return row.mobile.rankingUrl;
}

export function summarizeRankRows(rows: RankTrackingRow[]): RankDomainSummary {
  let top3 = 0;
  let top10 = 0;
  let improved = 0;
  let declined = 0;
  let unchanged = 0;
  const positions: number[] = [];

  for (const row of rows) {
    const position = bestPosition(row);
    const previous = bestPreviousPosition(row);

    if (position != null) {
      positions.push(position);
      if (position <= 3) top3 += 1;
      if (position <= 10) top10 += 1;
    }

    if (position != null && previous != null) {
      if (position < previous) improved += 1;
      else if (position > previous) declined += 1;
      else unchanged += 1;
    }
  }

  const avgPosition =
    positions.length > 0
      ? Math.round(
          (positions.reduce((sum, value) => sum + value, 0) / positions.length) *
            10,
        ) / 10
      : null;

  return {
    keywordsTracked: rows.length,
    top3,
    top10,
    improved,
    declined,
    unchanged,
    avgPosition,
  };
}

export function pickTopMovers(
  rows: RankTrackingRow[],
  limit = 12,
): RankMoverRow[] {
  const movers = rows
    .map((row) => {
      const position = bestPosition(row);
      const previousPosition = bestPreviousPosition(row);
      const change =
        position != null && previousPosition != null
          ? previousPosition - position
          : null;

      return {
        keyword: row.keyword,
        position,
        previousPosition,
        change,
        rankingUrl: primaryRankingUrl(row),
      };
    })
    .filter((row) => row.change != null && row.change !== 0);

  movers.sort((a, b) => Math.abs(b.change ?? 0) - Math.abs(a.change ?? 0));

  return movers.slice(0, limit);
}
