# 백엔드 문서 (docs/)

> Claude Code는 작업 영역에 맞는 문서를 먼저 읽고 구현한다. 전역 규칙은 루트 `CLAUDE.md`.

| 파일 | 내용 | 언제 읽나 |
|---|---|---|
| `db-schema.md` | 테이블 6개 + RLS + 인덱스 | DB·마이그레이션·쿼리 작업 |
| `domain-rules.md` | 2단 파이프라인·술/예산/카테고리/분위기 규칙 | `src/domain/` 구현·수정 |
| `toss-login.md` | 인가코드→토큰→userKey, mTLS | 인증(`services/tossLogin`) |
| `kakao-api.md` | 카카오 호출·캐싱(TTL) | `services/kakao`·추천 데이터 |
| `claude-api.md` | Claude API 웹서치 연동·이유 생성 | `services/claude` 구현 |
| `api-spec.md` | 엔드포인트 명세·상태 흐름 | `routes/` 구현 |

## 구현 순서 (권장)
1. DB 스키마 SQL (`supabase/migrations/`) — db-schema.md 기준
2. supabase 클라이언트 + 타입 생성 (config, types)
3. `src/domain/` 순수 함수 + 단위테스트 — domain-rules.md
4. `services/kakao` (캐싱) → `services/tossLogin` → `services/aggregation`
5. `routes/` 엔드포인트 — api-spec.md

## 선행 작업 (콘솔 담당과 공유, 코드 외)
- 사업자 인증(대표관리자) 완료
- 토스 로그인 콘솔 신청 + 약관 등록 + mTLS 인증서
- 카카오 개발자 앱 + REST 키 + 카카오맵 사용설정 ON
- Supabase 프로젝트 생성 + 키 발급
