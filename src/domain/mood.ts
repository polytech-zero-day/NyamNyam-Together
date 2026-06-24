// 분위기 (domain-rules.md §4) — 현재 가중치 0(사실상 미사용)
// Atmosphere 필드(goodForGroups 등)는 최고 티어라 안 받음 → 신뢰할 신호 없음.
// moodDominant는 입력으로 받되 정렬에 영향 주지 않는다. (추후 등록 데이터로 보강 시 재도입)
// ⚠️ 원본 votes의 quiet 비율 산출은 B 소유 → 여기서 하지 않는다(moodDominant 입력으로 받음).

import type { MoodPref } from './types';

/**
 * 분위기 점수. 현재 항상 0 (가중치 0).
 * 시그니처는 추후 재도입 대비 유지. moodDominant는 무시된다.
 */
export function computeMoodScore(_moodDominant: MoodPref | null): number {
  return 0;
}
