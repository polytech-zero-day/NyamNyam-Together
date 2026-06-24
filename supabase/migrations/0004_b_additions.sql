-- 0004_b_additions.sql — B파트 추가 컬럼 (우리 통합)
-- sessions에 최종 선정 식당 참조 추가.
-- 집계(aggregate) 완료 후 finalizeSession()이 채운다.

alter table sessions
  add column if not exists winner_recommendation_id uuid references recommendations(id);
