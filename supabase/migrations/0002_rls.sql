-- 0002_rls.sql — Row Level Security (A파트, 우리 소유)
-- 기준: docs/db-schema.md RLS 섹션.
--
-- 아키텍처: 프론트(토스 WebView) → Node 서버(HTTPS) → Supabase.
-- DB 접근은 Node 서버가 service_role 키로 수행. **service_role은 RLS를 우회**한다.
-- 따라서 MVP는 "RLS 활성화 + 클라이언트 직접 접근 차단(정책 없음=deny)"로 충분하다.
-- 서버 코드가 세션 단위 접근 검증을 책임진다.
--
-- ⚠️ service_role 키는 서버 환경변수에만. 클라이언트(프론트) 노출 금지.

alter table sessions        enable row level security;
alter table participants    enable row level security;
alter table votes           enable row level security;
alter table places          enable row level security;
alter table station_places  enable row level security;
alter table recommendations enable row level security;

-- 정책을 추가하지 않으면 anon/authenticated 역할은 모두 차단된다(deny by default).
-- service_role(서버)만 접근 → 현재 아키텍처에 부합.

-- ─────────────────────────────────────────────────────────────
-- (선택) 추후 Supabase를 클라이언트에 직접 노출할 경우의 예시 정책.
-- JWT 클레임에 user_key / 접근 가능한 session 정보를 매핑한 뒤 활성화할 것.
-- 지금은 비활성(주석) 상태로 둔다.
-- ─────────────────────────────────────────────────────────────

-- 식당 정보 읽기(인증 사용자 전체 허용):
-- create policy places_read_authenticated
--   on places for select to authenticated using (true);

-- 세션 단위 읽기(링크 공유 모델) — 실제로는 session 멤버십 검증 함수로 대체 권장:
-- create policy sessions_read_member
--   on sessions for select to authenticated using (true);
-- create policy recommendations_read_member
--   on recommendations for select to authenticated using (true);

-- 쓰기는 서버(service_role)만 수행 → authenticated/anon 쓰기 정책은 추가하지 않는다.
