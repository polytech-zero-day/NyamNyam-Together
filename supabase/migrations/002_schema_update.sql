-- 002_schema_update.sql
-- db-schema.md 기준으로 스키마 전면 재구성 (개발 단계 — 기존 테이블 교체).
-- sessions status: collecting / aggregating / voting / closed
-- restaurants: 마스터 테이블 (kakao_id UNIQUE, 웹서치 컬럼 포함)
-- station_restaurants: TTL 메타 전용 (payload 제거, lat/lng 추가)
-- recommendations: ai_reason, confidence 포함
-- votes: EAV → 직접 컬럼 구조

-- ──────────────────────────────────────────────────────
-- 기존 테이블 제거
-- ──────────────────────────────────────────────────────

DROP TABLE IF EXISTS votes              CASCADE;
DROP TABLE IF EXISTS recommendations    CASCADE;
DROP TABLE IF EXISTS restaurants        CASCADE;
DROP TABLE IF EXISTS participants       CASCADE;
DROP TABLE IF EXISTS sessions           CASCADE;
DROP TABLE IF EXISTS station_restaurants CASCADE;

-- ──────────────────────────────────────────────────────
-- station_restaurants (TTL 메타 + 역 좌표)
-- ──────────────────────────────────────────────────────

CREATE TABLE station_restaurants (
  station_id          text        PRIMARY KEY,
  station_lat         numeric     NOT NULL,
  station_lng         numeric     NOT NULL,
  kakao_fetched_at    timestamptz,
  web_enriched_at     timestamptz,
  restaurant_count    int
);

-- ──────────────────────────────────────────────────────
-- sessions — 모임
-- ──────────────────────────────────────────────────────

CREATE TABLE sessions (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_key    bigint      NOT NULL,
  title            text        NOT NULL,
  purpose          text,
  min_participants int         NOT NULL DEFAULT 2,
  station_id       text        NOT NULL REFERENCES station_restaurants(station_id),
  deadline         timestamptz,
  status           text        NOT NULL DEFAULT 'collecting'
                     CHECK (status IN ('collecting','aggregating','voting','closed')),
  created_at       timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────
-- participants — 참여자
-- ──────────────────────────────────────────────────────

CREATE TABLE participants (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_key   bigint      NOT NULL,
  joined_at  timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX ON participants(session_id, user_key);

-- ──────────────────────────────────────────────────────
-- restaurants — 식당 마스터 (카카오 + 웹서치 보완)
-- ──────────────────────────────────────────────────────

CREATE TABLE restaurants (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  kakao_id        text        NOT NULL,
  station_id      text        NOT NULL REFERENCES station_restaurants(station_id),
  name            text        NOT NULL,
  category_large  text        NOT NULL,
  category_mid    text,
  category_small  text,
  category_name   text        NOT NULL,
  address         text,
  road_address    text,
  phone           text,
  lat             numeric     NOT NULL,
  lng             numeric     NOT NULL,
  distance_m      integer,
  kakao_url       text,
  -- 웹서치 보완 컬럼 (확인된 것만, 불확실하면 null)
  price_level     integer     CHECK (price_level BETWEEN 1 AND 4),
  avg_price_min   integer,
  avg_price_max   integer,
  mood            text[],
  source          text,
  source_rating   numeric,
  source_url      text,
  crawled_at      timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  UNIQUE (kakao_id)
);

CREATE INDEX ON restaurants(station_id);
CREATE INDEX ON restaurants(station_id, source_rating DESC NULLS LAST);

-- ──────────────────────────────────────────────────────
-- recommendations — 추천 후보 (집계 결과)
-- ──────────────────────────────────────────────────────

CREATE TABLE recommendations (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  restaurant_id uuid        NOT NULL REFERENCES restaurants(id),
  name          text        NOT NULL,
  category_name text,
  place_type    text        NOT NULL
                  CHECK (place_type IN ('drink_required','compatible','general')),
  lat           double precision NOT NULL,
  lng           double precision NOT NULL,
  distance      int,
  place_url     text,
  relaxed       boolean     NOT NULL DEFAULT false,
  rank          int         NOT NULL,
  ai_reason     text,
  confidence    text        CHECK (confidence IN ('high','medium')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON recommendations(session_id, rank);

-- ──────────────────────────────────────────────────────
-- votes — 투표 (stage1: 제약 응답 / stage2: 식당 선택)
-- ──────────────────────────────────────────────────────

CREATE TABLE votes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_key      bigint      NOT NULL,
  stage         int         NOT NULL CHECK (stage IN (1, 2)),
  -- stage1 컬럼
  drink         text        CHECK (drink IN ('drinker','ok','uncomfortable')),
  budget_min    int,
  budget_max    int,
  categories    jsonb,
  mood          text        CHECK (mood IN ('quiet','any')),
  -- stage2 컬럼
  restaurant_id uuid        REFERENCES recommendations(id),
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- 1인 1응답 보장 (stage별)
CREATE UNIQUE INDEX ON votes(session_id, user_key) WHERE stage = 1;
CREATE UNIQUE INDEX ON votes(session_id, user_key) WHERE stage = 2;

CREATE INDEX ON votes(session_id, user_key, stage);

-- ──────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────

ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants       ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes              ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_restaurants ENABLE ROW LEVEL SECURITY;
