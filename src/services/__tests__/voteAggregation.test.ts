import { buildConstraintsFromVotes, Stage1Vote } from '../voteAggregation';

const v = (
  drink: Stage1Vote['drink'],
  budget_max: number | null,
  categories: string[] = [],
  budget_min: number | null = null,
  mood: Stage1Vote['mood'] = null,
): Stage1Vote => ({ drink, budget_min, budget_max, categories, mood });

describe('buildConstraintsFromVotes (잠정 B 집계)', () => {
  it('drink 분포 보존', () => {
    const c = buildConstraintsFromVotes([
      v('drinker', 20000),
      v('ok', 20000),
      v('ok', 20000),
      v('uncomfortable', 20000),
    ]);
    expect(c.drink).toEqual({ drinker: 1, ok: 2, uncomfortable: 1 });
  });

  it('budgetMax = P25 보수 컷, budgetMin = 최솟값', () => {
    const c = buildConstraintsFromVotes([
      v('ok', 10000, [], 8000),
      v('ok', 20000, [], 10000),
      v('ok', 30000, [], 12000),
      v('ok', 40000, [], 15000),
    ]);
    // maxes 정렬 [10,20,30,40], P25 index = floor(4*0.25)=1 → 20000
    expect(c.budgetMax).toBe(20000);
    expect(c.budgetMin).toBe(8000);
  });

  it('categories 표수 집계 (2표 임계는 C가 적용 — 여기선 표수만)', () => {
    const c = buildConstraintsFromVotes([
      v('ok', 20000, ['한식', '중식']),
      v('ok', 20000, ['한식']),
    ]);
    const han = c.categories.find((x) => x.name === '한식');
    const jung = c.categories.find((x) => x.name === '중식');
    expect(han?.votes).toBe(2);
    expect(jung?.votes).toBe(1);
  });

  it('moodDominant: quiet 과반 → quiet, 아니면 any, 없으면 null', () => {
    expect(
      buildConstraintsFromVotes([
        v('ok', 1, [], null, 'quiet'),
        v('ok', 1, [], null, 'quiet'),
        v('ok', 1, [], null, 'any'),
      ]).moodDominant,
    ).toBe('quiet');
    expect(
      buildConstraintsFromVotes([v('ok', 1, [], null, 'any'), v('ok', 1, [], null, 'quiet')])
        .moodDominant,
    ).toBe('any');
    expect(buildConstraintsFromVotes([v('ok', 1)]).moodDominant).toBeNull();
  });

  it('빈 투표 → 중립값(분포 0, budgetMax ∞)', () => {
    const c = buildConstraintsFromVotes([]);
    expect(c.drink).toEqual({ drinker: 0, ok: 0, uncomfortable: 0 });
    expect(c.budgetMax).toBe(Number.POSITIVE_INFINITY);
    expect(c.categories).toEqual([]);
  });
});
