const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
const POINTS_PER_YEAR = 0.5;
const MAX_LONGEVITY_SCORE = 3;

export function longevityScore(openDate: string | null, asOf: Date = new Date()): number {
  if (!openDate) return 0;
  const opened = new Date(openDate).getTime();
  if (Number.isNaN(opened)) return 0;
  const years = (asOf.getTime() - opened) / MS_PER_YEAR;
  if (years <= 0) return 0;
  return Math.min(years * POINTS_PER_YEAR, MAX_LONGEVITY_SCORE);
}
