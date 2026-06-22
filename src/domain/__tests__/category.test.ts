import { getEligibleCategories, scoreByCategoryMatch, MIN_CATEGORY_VOTES } from '../category';

describe('getEligibleCategories', () => {
  it('2표 이상 카테고리만 반환', () => {
    const responses = [['한식', '중식'], ['한식', '일식'], ['양식']];
    const eligible = getEligibleCategories(responses);
    expect(eligible).toContain('한식'); // 2표
    expect(eligible).not.toContain('중식'); // 1표
    expect(eligible).not.toContain('일식'); // 1표
    expect(eligible).not.toContain('양식'); // 1표
  });

  it('정확히 2표 → 포함', () => {
    const responses = [['한식'], ['한식']];
    expect(getEligibleCategories(responses)).toContain('한식');
  });

  it('모두 1표 → 빈 배열', () => {
    const responses = [['한식'], ['일식'], ['중식']];
    expect(getEligibleCategories(responses)).toEqual([]);
  });

  it('빈 응답 → 빈 배열', () => {
    expect(getEligibleCategories([])).toEqual([]);
    expect(getEligibleCategories([[]])).toEqual([]);
  });

  it('minVotes 파라미터 적용', () => {
    const responses = [['한식'], ['한식'], ['한식']];
    expect(getEligibleCategories(responses, 3)).toContain('한식');
    expect(getEligibleCategories(responses, 4)).not.toContain('한식');
    expect(getEligibleCategories(responses, 1)).toContain('한식');
  });

  it('빈 문자열·공백 무시', () => {
    const responses = [
      ['', '한식'],
      ['한식', ' '],
    ];
    const eligible = getEligibleCategories(responses);
    expect(eligible.some((c) => c === '' || c.trim() === '')).toBe(false);
    expect(eligible).toContain('한식');
  });

  it('MIN_CATEGORY_VOTES 기본값은 2', () => {
    expect(MIN_CATEGORY_VOTES).toBe(2);
  });
});

describe('scoreByCategoryMatch', () => {
  it('매칭 카테고리 수 × 10점', () => {
    expect(scoreByCategoryMatch('음식점 > 한식 > 국밥', ['한식'])).toBe(10);
    expect(scoreByCategoryMatch('음식점 > 한식', ['한식', '중식'])).toBe(10); // 한식만 매칭
  });

  it('카카오 category_name 부분 문자열 포함 시 매칭', () => {
    expect(scoreByCategoryMatch('음식점 > 일식 > 초밥', ['일식'])).toBe(10);
    expect(scoreByCategoryMatch('음식점 > 중식 > 양꼬치', ['중식', '양꼬치'])).toBe(20);
  });

  it('매칭 없으면 0점', () => {
    expect(scoreByCategoryMatch('음식점 > 중식', ['한식', '일식'])).toBe(0);
  });

  it('eligibleCategories 비어있으면 0점 (전 장소 동점)', () => {
    expect(scoreByCategoryMatch('음식점 > 한식', [])).toBe(0);
  });
});
