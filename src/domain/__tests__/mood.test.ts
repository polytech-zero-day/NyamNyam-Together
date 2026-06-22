import { isQuietPlace, computeQuietRatio, computeMoodScore } from '../mood';

describe('isQuietPlace', () => {
  it('카페·카페,디저트 → quiet', () => {
    expect(isQuietPlace('카페')).toBe(true);
    expect(isQuietPlace('카페,디저트')).toBe(true);
    expect(isQuietPlace('카페 > 북카페')).toBe(true);
  });

  it('음식점·주점 → not quiet', () => {
    expect(isQuietPlace('음식점 > 한식')).toBe(false);
    expect(isQuietPlace('주점 > 이자카야')).toBe(false);
  });
});

describe('computeQuietRatio', () => {
  it('전원 quiet → 1.0', () => {
    expect(computeQuietRatio(['quiet', 'quiet', 'quiet'])).toBe(1);
  });

  it('전원 any → 0.0', () => {
    expect(computeQuietRatio(['any', 'any'])).toBe(0);
  });

  it('혼합 → 정확한 비율', () => {
    expect(computeQuietRatio(['quiet', 'any', 'quiet', 'any'])).toBe(0.5);
    expect(computeQuietRatio(['quiet', 'quiet', 'any'])).toBeCloseTo(2 / 3);
  });

  it('null/undefined 제외하고 계산', () => {
    expect(computeQuietRatio([null, 'quiet', undefined, 'quiet'])).toBe(1);
    expect(computeQuietRatio([null, 'any'])).toBe(0);
  });

  it('전원 null/undefined → 0', () => {
    expect(computeQuietRatio([null, undefined, null])).toBe(0);
    expect(computeQuietRatio([])).toBe(0);
  });
});

describe('computeMoodScore — restaurants.mood 배열 기반', () => {
  it("quiet 다수(>50%) + mood에 '조용한' 포함 → 2점", () => {
    expect(computeMoodScore(['조용한'], 0.6)).toBe(2);
    expect(computeMoodScore(['조용한', '룸있음'], 1.0)).toBe(2);
  });

  it("quiet 다수 + mood에 '조용한' 없음 → 0점", () => {
    expect(computeMoodScore(['시끌벅적'], 0.8)).toBe(0);
    expect(computeMoodScore(['넓은', '단체석'], 0.9)).toBe(0);
  });

  it('mood가 null → 0점 (domain-rules: null이면 가중치 0)', () => {
    expect(computeMoodScore(null, 0.9)).toBe(0);
    expect(computeMoodScore(null, 1.0)).toBe(0);
  });

  it('quiet 비율 ≤ 50% → 0점 (mood 무관)', () => {
    expect(computeMoodScore(['조용한'], 0.5)).toBe(0);
    expect(computeMoodScore(['조용한'], 0.0)).toBe(0);
    expect(computeMoodScore(null, 0.3)).toBe(0);
  });
});
