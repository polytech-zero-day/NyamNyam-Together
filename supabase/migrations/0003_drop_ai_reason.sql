-- 0003_drop_ai_reason.sql — recommendations.ai_reason 컬럼 제거 (A파트, 우리 소유)
-- 배경: 추천 서버에서 AI(ai_reason) 역할 폐기 (선정은 코드가 끝냄, AI 개입 없음).
-- 0001_init.sql은 이미 ai_reason 없이 생성하지만, 구버전 0001로 생성된 기존 DB에는
-- 컬럼이 남아 있을 수 있다. DROP COLUMN IF EXISTS 로 신규/구 DB 양쪽 모두 안전하게 처리.
-- 적용: `supabase db push` 또는 Supabase Studio SQL Editor.

alter table recommendations drop column if exists ai_reason;
