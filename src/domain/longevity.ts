// longevity (domain-rules.md §6)
// 출처는 등록(owner) 식당 open_date뿐. 구글 openingDate는 미래 개업 전용이라 적용 안 함.
// 오래 운영 = 상권 생존의 방증 → 등록 식당에 약한 가점. open_date 없으면 0(감점 아님).

const MS_PER_YEAR = 365.25 * 24 * 60 * 60 * 1000;
// 2년당 1점, 최대 3점. 카테고리 매칭(10점/개)보다 약하게 유지.
const POINTS_PER_YEAR = 0.5;
const MAX_LONGEVITY_SCORE = 3;

/**
 * 등록 식당 open_date 기반 약한 가점.
 * @param openDate ISO 날짜 문자열 또는 null (google 식당은 null)
 * @param asOf 기준 시각 (테스트 결정성 위해 주입 가능, 기본 현재)
 */
export function longevityScore(openDate: string | null, asOf: Date = new Date()): number {
  if (!openDate) return 0;
  const opened = new Date(openDate).getTime();
  if (Number.isNaN(opened)) return 0;
  const years = (asOf.getTime() - opened) / MS_PER_YEAR;
  if (years <= 0) return 0;
  return Math.min(years * POINTS_PER_YEAR, MAX_LONGEVITY_SCORE);
}
