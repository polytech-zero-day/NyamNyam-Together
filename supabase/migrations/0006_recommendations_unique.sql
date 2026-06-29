-- recommendations 테이블에 (session_id, place_id) 유니크 제약 추가
-- writeRecommendations의 upsert onConflict 지원을 위해 필요
alter table recommendations
  add constraint recommendations_session_place_unique unique (session_id, place_id);
