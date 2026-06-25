-- 정렬 기준(review_count/rating/random)을 참여자 stage1 투표로 받기 위한 컬럼.
-- 집계 시 다수결로 session.sort_mode 를 결정한다(동점/무응답 → review_count).
alter table votes add column if not exists sort_pref text;
