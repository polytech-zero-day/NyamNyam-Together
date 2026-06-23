-- 0001_init.sql — 냠냠투게더 백엔드 (A·C 파트) 초기 스키마
-- 기준: docs/db-schema.md. 출시 전 클린 스키마 (레거시 restaurants/station_restaurants 폐기).
-- 적용: `supabase db push` 또는 Supabase Studio SQL Editor.
-- 소유: 테이블 스키마·RLS는 우리(A). sessions/participants/votes 위의 상태전환·집계 로직은 B파트.

create extension if not exists pgcrypto;  -- gen_random_uuid()

-- ── (선택) 레거시 정리: 기존 테이블이 있으면 제거. 출시 전 한정. 필요 시 주석 해제.
-- drop table if exists votes, recommendations, places, station_places,
--                       participants, sessions, restaurants, station_restaurants cascade;

-- ─────────────────────────────────────────────────────────────
-- 1) station_places — 역 단위 place_id 디스커버리 메타 (콘텐츠 캐시 아님)
-- ─────────────────────────────────────────────────────────────
create table if not exists station_places (
  station_id            text primary key,
  station_lat           numeric not null,
  station_lng           numeric not null,
  places_discovered_at  timestamptz,            -- 마지막 Nearby 탐색 시각 (TTL 30일)
  place_count           int not null default 0
);

-- ─────────────────────────────────────────────────────────────
-- 2) sessions — 모임  (스키마=우리 / 상태전환·마감=B파트)
-- ─────────────────────────────────────────────────────────────
create table if not exists sessions (
  id                uuid primary key default gen_random_uuid(),
  host_user_key     bigint not null,                 -- 토스 userKey (공통 인증)
  title             text   not null,
  purpose           text,                            -- MVP: friend
  min_participants  int    not null default 2,
  station_id        text   not null,                 -- 위치(역) 식별자
  station_lat       numeric,
  station_lng       numeric,
  deadline          timestamptz,
  status            text   not null default 'collecting'
                      check (status in ('collecting','aggregating','voting','closed')),
  sort_mode         text   not null default 'review_count'
                      check (sort_mode in ('review_count','rating','random')),
  sort_seed         int,                             -- random 정렬 고정 시드
  created_at        timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 3) participants — 참여자  (스키마=우리 / 입장=B·공통)
-- ─────────────────────────────────────────────────────────────
create table if not exists participants (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid   not null references sessions(id) on delete cascade,
  user_key    bigint not null,
  joined_at   timestamptz not null default now(),
  unique (session_id, user_key)               -- 중복 입장 방지
);

-- ─────────────────────────────────────────────────────────────
-- 4) places — 식당 마스터 (출처 구분: google / owner / community)
--    google: place_id + 가공값만. owner/community: first-party 전체 저장.
-- ─────────────────────────────────────────────────────────────
create table if not exists places (
  id              uuid primary key default gen_random_uuid(),
  source          text not null check (source in ('google','owner','community')),
  google_place_id text unique,                       -- ToS상 유일 영구 저장 필드 (NULL 다중 허용)
  station_id      text not null references station_places(station_id),
  place_type      text check (place_type in ('drink_required','compatible','general')),
  name            text,                              -- owner/community 만 (google=NULL, 라이브)
  lat             numeric,
  lng             numeric,
  category        text,
  price_level     int  check (price_level between 1 and 4),
  open_date       date,                              -- longevity 신호 (등록 식당)
  status          text check (status in ('active','closed')),
  created_at      timestamptz not null default now(),
  -- google 출처면 google_place_id 필수
  constraint places_google_id_required
    check (source <> 'google' or google_place_id is not null)
);

-- ─────────────────────────────────────────────────────────────
-- 5) recommendations — 추천 후보 스냅샷 (우리가 작성)
--    구글 콘텐츠 비정규화 저장 안 함 — place 참조 + 우리 생성/파생값만.
-- ─────────────────────────────────────────────────────────────
create table if not exists recommendations (
  id                   uuid primary key default gen_random_uuid(),
  session_id           uuid not null references sessions(id) on delete cascade,
  place_id             uuid not null references places(id),
  place_type           text,
  rank                 int  not null,
  relaxed              boolean not null default false,
  review_count_at_agg  int,        -- 정렬·표본보정용 내부 수치 (사용자 재노출 캐시 아님)
  rating_at_agg        numeric,    -- 정렬용 스냅샷
  created_at           timestamptz not null default now()
);

-- ─────────────────────────────────────────────────────────────
-- 6) votes — 투표  (스키마=우리 / 집계=B파트)
--    ⚠️ 우리 추천 로직은 votes를 직접 집계하지 않는다(B가 제약으로 넘김).
-- ─────────────────────────────────────────────────────────────
create table if not exists votes (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid   not null references sessions(id) on delete cascade,
  user_key           bigint not null,
  stage              int    not null check (stage in (1,2)),
  drink              text   check (drink in ('drinker','ok','uncomfortable')),
  budget_min         int,
  budget_max         int,
  categories         jsonb,                          -- 한글 분류 다중선택
  mood               text   check (mood in ('quiet','any')),
  recommendation_id  uuid   references recommendations(id),  -- stage2
  created_at         timestamptz not null default now(),
  unique (session_id, user_key, stage)         -- 1인 1표 (단계별)
);

-- ─────────────────────────────────────────────────────────────
-- 인덱스
-- ─────────────────────────────────────────────────────────────
create index if not exists idx_places_station            on places(station_id);
create index if not exists idx_places_source             on places(source);
create index if not exists idx_recommendations_sess_rank on recommendations(session_id, rank);
create index if not exists idx_votes_sess_user_stage     on votes(session_id, user_key, stage);
-- places(google_place_id) UNIQUE 제약이 인덱스를 겸함.
