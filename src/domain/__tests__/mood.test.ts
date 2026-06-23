import { computeMoodScore } from '../mood';

describe('computeMoodScore — 현재 가중치 0 (미사용)', () => {
  it('moodDominant 무관 항상 0', () => {
    expect(computeMoodScore('quiet')).toBe(0);
    expect(computeMoodScore('any')).toBe(0);
    expect(computeMoodScore(null)).toBe(0);
  });
});
