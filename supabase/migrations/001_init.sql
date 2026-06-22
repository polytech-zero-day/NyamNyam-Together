-- NyamNyam-Together 초기 스키마
-- 서버는 service_role로 접근 → RLS 자동 우회.
-- anon/authenticated 역할의 직접 접근은 정책 없음 = 거부.

-- ──────────────────────────────────────────────────────
-- 테이블
-- ──────────────────────────────────────────────────────

CREATE TABLE sessions (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_user_key bigint      NOT NULL,
  region        text        NOT NULL,               -- 지역명 (카카오 캐시 키)
  region_lat    double precision NOT NULL,          -- 위도
  region_lng    double precision NOT NULL,          -- 경도
  headcount     int         NOT NULL CHECK (headcount >= 2),
  purpose       text,
  deadline      timestamptz,                        -- null = 수동 종료만
  status        text        NOT NULL DEFAULT 'created'
                  CHECK (status IN ('created','voting_stage1','listing','voting_stage2','closed')),
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE participants (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_key    bigint      NOT NULL,
  joined_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, user_key)
);

-- 파이프라인 출력 후보 (세션당 최대 10개)
CREATE TABLE restaurants (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  kakao_place_id text        NOT NULL,
  name           text        NOT NULL,
  category_name  text        NOT NULL DEFAULT '',
  place_type     text        NOT NULL
                   CHECK (place_type IN ('drink_required','compatible','general')),
  lat            double precision NOT NULL,   -- 위도 (카카오 y)
  lng            double precision NOT NULL,   -- 경도 (카카오 x)
  distance       int,                         -- 역에서 거리(m)
  place_url      text        NOT NULL DEFAULT '',
  relaxed        boolean     NOT NULL DEFAULT false,
  rank           int         NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now()
);

-- stage 1: 제약 응답 / stage 2: 식당 선택 — EAV(item/value) 패턴으로 통합
CREATE TABLE votes (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id     uuid        NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  participant_id uuid        NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  stage          int         NOT NULL CHECK (stage IN (1, 2)),
  item           text        NOT NULL,   -- 예: 'drink', 'budget_max', 'categories', 'mood', 'restaurant_id'
  value          text        NOT NULL,
  created_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, participant_id, stage, item)
);

-- 역 단위 카카오 캐시 (TTL 30일, Lazy 방식)
CREATE TABLE station_restaurants (
  station_id  text        PRIMARY KEY,
  payload     jsonb       NOT NULL,
  fetched_at  timestamptz NOT NULL DEFAULT now()
);

-- ──────────────────────────────────────────────────────
-- RLS
-- ──────────────────────────────────────────────────────

ALTER TABLE sessions           ENABLE ROW LEVEL SECURITY;
ALTER TABLE participants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurants         ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes               ENABLE ROW LEVEL SECURITY;
ALTER TABLE station_restaurants ENABLE ROW LEVEL SECURITY;

-- ──────────────────────────────────────────────────────
-- 인덱스
-- ──────────────────────────────────────────────────────

CREATE INDEX idx_sessions_status      ON sessions (status);
CREATE INDEX idx_sessions_host        ON sessions (host_user_key);
CREATE INDEX idx_sessions_deadline    ON sessions (deadline) WHERE deadline IS NOT NULL;

CREATE INDEX idx_participants_session ON participants (session_id);

CREATE INDEX idx_restaurants_session  ON restaurants (session_id, rank);

CREATE INDEX idx_votes_lookup         ON votes (session_id, participant_id, stage);
