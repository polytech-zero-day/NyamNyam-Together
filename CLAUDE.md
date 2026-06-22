# CLAUDE.md — 냠냠투게더 백엔드 (Server)

> Claude Code가 매번 참조하는 백엔드 전역 컨텍스트. 코드 생성·수정 전 이 규칙을 우선 따른다.
> 화면/도메인 세부는 `docs/`를 참조한다. 이 파일은 색인 + 전역 규칙만 담는다.

---

## 1. 프로젝트 개요

냠냠투게더의 백엔드. 모임 식당 결정 서비스(앱인토스 미니앱)의 서버.
- 역할: 토스 로그인 인증, 카카오 API 미들웨어(키 보호·캐싱), 투표 집계, 추천 파이프라인(선정 로직).
- 프론트(토스 WebView, React)와 HTTPS로 통신. 프론트는 토스 인프라 배포, 서버는 별도 호스팅.
- 핵심 철학: **확정기가 아닌 압축기.** 후보 3~4곳으로 좁혀주고 선택은 사용자.
- AI 역할: **선정은 코드가, AI는 조건 판단 보조.** 식당 목록 생성은 코드, 조건 필터링 보조와 추천 이유 생성만 AI.

## 2. 기술 스택 (고정)

- **Node.js + TypeScript**
- **@supabase/supabase-js** — DB 접근 (★ ORM 사용 안 함. Prisma/TypeORM 도입 금지)
- **Supabase (PostgreSQL + RLS)** — DB 역할만. 비즈니스 로직은 Node 서버가 담당
- HTTP 프레임워크: Express (또는 동급 경량). 과한 추상화 지양
- 타입: Supabase CLI로 생성한 `database.types.ts` 사용 (수기 엔티티 클래스 만들지 말 것)
- **@anthropic-ai/sdk** — Claude API (웹서치 도구 포함)

> Edge Function(Deno) 사용하지 않는다. 모든 서버 로직은 Node에서.

## 3. 아키텍처

```
[토스 WebView (React)]
   │ HTTPS
   ▼
[Node.js 서버]  ← 이 레포
   ├─ 토스 로그인: 인가코드→토큰 교환 (mTLS 필요)
   ├─ 카카오 미들웨어: 호출 + 캐싱(TTL)  ← API 키는 서버에만
   ├─ Claude API: 조건 필터링 보조 + 추천 이유 생성 (웹서치 포함)
   ├─ 도메인: 2단 파이프라인(선정 로직, 순수 함수)
   └─ @supabase/supabase-js
        │
        ▼
[Supabase: PostgreSQL + RLS]
        │
        ▼
[카카오 로컬 API]          [Claude API + 웹서치]
```

## 4. 폴더 구조

```
src/
├─ config/supabase.ts        # supabase 클라이언트
├─ domain/                   # ★ 순수 함수 (선정 로직, 외부 의존 X, 테스트 필수)
│  ├─ placeType.ts           # 술→장소타입 (domain-rules.md 1)
│  ├─ budget.ts              # 예산 보수적 컷 (2)
│  ├─ category.ts            # 음식 2표 매칭 (3)
│  ├─ mood.ts                # 분위기 가중치 (4)
│  ├─ pipeline.ts            # 2단 파이프라인 통합
│  └─ __tests__/
├─ services/                 # 외부 연동·비즈니스 로직
│  ├─ kakao.ts               # 카카오 호출 + 캐싱(TTL)  (kakao-api.md)
│  ├─ claude.ts              # Claude API + 웹서치 필터링·이유 생성 (claude-api.md)
│  ├─ tossLogin.ts           # 인가코드→토큰→userKey  (toss-login.md)
│  └─ aggregation.ts         # 종료 트리거·스냅샷 집계
├─ routes/                   # 엔드포인트 (요청/응답만, 로직은 services/domain)
│  ├─ sessions.ts
│  ├─ participants.ts
│  ├─ votes.ts
│  └─ recommend.ts
├─ types/database.types.ts   # Supabase 자동생성
└─ index.ts
supabase/migrations/         # 테이블 생성 SQL (db-schema.md 기준)
scripts/
└─ seed-restaurants.ts       # 주요 역 사전 배치 스크립트 (배포 안 함)
```

## 5. 도메인 규칙 — ⚠️ AI 임의 변경 금지

> 선정 로직은 전부 `src/domain/`의 순수 함수로 구현한다.
> 상세 규칙은 `docs/domain-rules.md`. 프론트 CLAUDE.md 4장과 동일하게 유지.

요약:
- 2단 파이프라인: 필터형(술·예산·위치) → 선호형(음식 2표·분위기·source_rating) → 상위 3~4곳
- 술: ③(불편) 1명이라도 → 일반 위주 / ②만·①+② → 양립+일반 / ①포함+③없음 → 전부
- 예산: restaurants.avg_price_min 기준 필터. null이면 필터 미적용 후 Claude 판단에 위임
- 음식: 2표 이상 카테고리만 채택(합집합 폭발 방지)
- 분위기: 거르지 않음, 약한 정렬 가중치
- 0개 완화: 예산→카테고리→반경 순, 술 제약 유지 + 완화 공지 플래그

## 6. 데이터 소스·캐싱 전략 (kakao-api.md 참조)

### 카카오 API
- 서버만 호출 (REST 키 .env, 프론트 노출 금지)
- `sort=accuracy` — 카카오 자체 인기도 랭킹 기준 상위 45개 (3페이지 × 15개)
- 카카오는 평점·가격·분위기 미제공

### 2단계 데이터 구축 전략
```
[사전 배치 — scripts/seed-restaurants.ts, 배포 안 함]
카카오 API → 주요 역 음식점 45개 수집 → restaurants 테이블 저장
Claude 웹서치(다이닝코드·식신 우선) → price_level·mood·avg_price 보완 → upsert

[실시간 세션 — Lazy Loading]
해당 역 restaurants 있고 30일 이내 → DB 조회만
없거나 만료 → 카카오 호출 후 저장 (웹서치 보완은 비동기 백그라운드)
```

### Claude 웹서치 참조 우선순위
1. 다이닝코드 (광고 필터링 빅데이터, 가장 신뢰도 높음)
2. 식신 (방문 빅데이터, 3대 미식 가이드)
3. 카카오맵 리뷰
- ❌ 네이버 블로그 제외 (광고성 높음)

### 저장 원칙 — "확인된 것만, 불확실하면 null"
- 직접 확인된 정보만 저장. 추정·일반 상식 기반 값 저장 금지
- source_url 없으면 해당 필드 전부 null
- null이 많아도 괜찮음. 잘못된 데이터보다 null이 낫다

## 7. Claude API 역할 (claude-api.md 참조)

```
입력: 카카오 목록에서 SQL 1차 필터된 후보 (최대 15개)
역할:
  1. 다이닝코드·식신 웹서치로 각 식당 실제 정보 확인
  2. 그룹 조건(예산·분위기) 기준 최종 3~4곳 선별
  3. 각 식당 추천 이유(ai_reason) 한 줄 생성
출력: JSON { recommendations: [{ place_name, reason, confidence }] }
```

**AI 할루시네이션 방지 규칙:**
- 카카오 목록 밖의 식당 절대 추천 금지
- 웹서치로 확인 안 되면 confidence: "low" → 서비스에서 제외
- "삼겹살집은 보통 2만원대" 같은 일반 상식 추론 금지

## 8. 종료 트리거 (aggregation.ts)

- 수동 종료(생성자) OR 마감시간 — 먼저 오는 것. (MVP: Lazy 체크 + 수동 버튼)
- 마감시간은 **접근 시점에 코드가 비교**(now > deadline → 집계). pg_cron 자동화는 추후.
- 종료 시 응답 스냅샷으로 1회 집계 → status 전환(collecting→aggregating→voting→closed).

## 9. 인증: 토스 로그인 (toss-login.md)

- 클라이언트가 `appLogin`으로 인가코드 획득 → 서버로 전달.
- **서버에서** 인가코드→AccessToken 교환, 사용자 정보 조회로 **userKey** 확보. (mTLS 인증서 필요)
- participants 식별자 = **userKey(number)**. 중복 입장·중복 투표 방지 키.
- AccessToken/RefreshToken은 서버에서만 보관. 클라이언트 장기 저장 금지.

## 10. 금지 사항

- ❌ ORM(Prisma/TypeORM) 도입 — supabase-js만
- ❌ Edge Function(Deno) — Node로
- ❌ LLM이 카카오 목록 밖의 식당 직접 생성·추천
- ❌ 웹서치 미확인 정보를 DB에 저장 (추정값 저장 금지)
- ❌ confidence: low 식당 최종 추천에 포함
- ❌ 시크릿(카카오 키, 토스 client_secret, Supabase service_role, mTLS 키, Anthropic API 키) 하드코딩·git 커밋
- ❌ RLS 우회(service_role 키를 클라이언트 노출 경로에 사용)
- ❌ 5장 도메인 규칙 임의 변경
- ❌ Out of Scope 구현(더치페이·푸시·AI 후기분석)
- ❌ 네이버 블로그를 웹서치 출처로 사용 (광고성)

## 11. 참고 문서 (docs/)
- `db-schema.md` — 테이블 + RLS
- `api-spec.md` — 엔드포인트 명세
- `domain-rules.md` — 선정 로직 상세
- `toss-login.md` — 로그인 플로우
- `kakao-api.md` — 카카오 호출·캐싱
- `claude-api.md` — Claude API 웹서치 연동 (신규)
