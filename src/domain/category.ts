// 음식 카테고리 2표 이상 채택: 합집합 폭발 방지 (domain-rules.md 3장)
// ⚠️ 필터 아님 — 정렬용 점수로만 사용. 매칭 안 된 장소도 후보 풀에 남는다.

export const MIN_CATEGORY_VOTES = 2;

// 참여자 전체 응답에서 MIN_VOTES 이상 선택된 카테고리만 반환
export function getEligibleCategories(
  allFoodCategories: string[][],
  minVotes: number = MIN_CATEGORY_VOTES,
): string[] {
  const counts = new Map<string, number>();
  for (const cats of allFoodCategories) {
    for (const cat of cats) {
      if (cat.trim()) {
        counts.set(cat, (counts.get(cat) ?? 0) + 1);
      }
    }
  }
  return [...counts.entries()].filter(([, count]) => count >= minVotes).map(([cat]) => cat);
}

// 카카오 category_name과 선호 카테고리의 매칭 점수 (정렬 가중치)
// 매칭 1개당 10점. eligibleCategories 비어있으면 0점(전 장소 동점).
export function scoreByCategoryMatch(kakaoCategory: string, eligibleCategories: string[]): number {
  if (eligibleCategories.length === 0) return 0;
  const matchCount = eligibleCategories.filter((cat) => kakaoCategory.includes(cat)).length;
  return matchCount * 10;
}
