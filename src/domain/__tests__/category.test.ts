import {
  getEligibleCategories,
  scoreByCategoryMatch,
  googleTypesForCategory,
  MIN_CATEGORY_VOTES,
} from '../category';

describe('getEligibleCategories — 2표 임계 (우리 소유)', () => {
  it('2표 이상만 채택', () => {
    const cats = [
      { name: '한식', votes: 2 },
      { name: '중식', votes: 1 },
      { name: '일식', votes: 3 },
    ];
    const eligible = getEligibleCategories(cats);
    expect(eligible).toContain('한식');
    expect(eligible).toContain('일식');
    expect(eligible).not.toContain('중식');
  });

  it('정확히 2표 → 포함, 1표 → 제외', () => {
    expect(getEligibleCategories([{ name: '한식', votes: 2 }])).toEqual(['한식']);
    expect(getEligibleCategories([{ name: '한식', votes: 1 }])).toEqual([]);
  });

  it('빈 입력 → 빈 배열', () => {
    expect(getEligibleCategories([])).toEqual([]);
  });

  it('빈 이름 무시', () => {
    expect(getEligibleCategories([{ name: ' ', votes: 5 }])).toEqual([]);
  });

  it('minVotes 파라미터', () => {
    const cats = [{ name: '한식', votes: 3 }];
    expect(getEligibleCategories(cats, 3)).toEqual(['한식']);
    expect(getEligibleCategories(cats, 4)).toEqual([]);
  });

  it('MIN_CATEGORY_VOTES 기본값은 2', () => {
    expect(MIN_CATEGORY_VOTES).toBe(2);
  });
});

describe('googleTypesForCategory — 한글 ↔ google types', () => {
  it('매핑 존재', () => {
    expect(googleTypesForCategory('한식')).toContain('korean_restaurant');
    expect(googleTypesForCategory('일식')).toEqual(
      expect.arrayContaining(['japanese_restaurant', 'sushi_restaurant', 'ramen_restaurant']),
    );
  });
  it('매핑 없는 분류 → 빈 배열', () => {
    expect(googleTypesForCategory('알수없음')).toEqual([]);
  });
});

describe('scoreByCategoryMatch — types 겹침 점수', () => {
  it('채택 카테고리 매핑 type과 겹치면 카테고리당 10점', () => {
    expect(scoreByCategoryMatch(['korean_restaurant'], ['한식'])).toBe(10);
    expect(scoreByCategoryMatch(['sushi_restaurant'], ['일식'])).toBe(10);
  });

  it('여러 카테고리 매칭 → 합산', () => {
    expect(
      scoreByCategoryMatch(['korean_restaurant', 'chinese_restaurant'], ['한식', '중식']),
    ).toBe(20);
  });

  it('매칭 없으면 0점', () => {
    expect(scoreByCategoryMatch(['chinese_restaurant'], ['한식', '일식'])).toBe(0);
  });

  it('eligible 비어있으면 0점', () => {
    expect(scoreByCategoryMatch(['korean_restaurant'], [])).toBe(0);
  });
});
