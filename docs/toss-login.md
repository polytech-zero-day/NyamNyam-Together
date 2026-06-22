# 토스 로그인 연동 (toss-login.md)

> 출처: 앱인토스 개발자센터 토스 로그인 가이드. 값/엔드포인트는 구현 시 공식 문서로 재확인.

## 전체 흐름

```
[클라이언트(미니앱)]                      [서버(이 레포)]                 [앱인토스 서버]
 appLogin() 호출
   → 약관 동의(최초) → authorizationCode 획득
   → {authorizationCode, referrer} 서버로 전달 ──▶
                                          토큰 교환 요청 (mTLS) ──────▶
                                          ◀── accessToken/refreshToken
                                          사용자 정보 조회(login-me) ──▶
                                          ◀── userKey 등
                                          userKey로 participant 식별/저장
   ◀── 세션 진입 허용
```

## 단계별

### 1) 클라이언트: 인가 코드 (프론트 담당)
- `appLogin()` (`@apps-in-toss/web-framework`) 호출 → `{ authorizationCode, referrer }`.
- 인가 코드는 **10분 유효, 일회성**. 장기 저장 금지. 서버로 즉시 전달.
- referrer: DEFAULT(토스앱) / SANDBOX(샌드박스).

### 2) 서버: 토큰 교환 (★ mTLS 필요)
- BaseURL: `https://apps-in-toss-api.toss.im`
- POST `/api-partner/v1/apps-in-toss/user/oauth2/generate-token`
- body: `{ authorizationCode, referrer }`
- 응답: `accessToken`(1시간), `refreshToken`(14일), scope 등.
- ⚠️ **서버 간 통신에 mTLS 인증서 필수.** 인증서 발급 선행(콘솔/통합 절차). 없으면 호출 불가.

### 3) 서버: 사용자 정보 조회
- GET `/api-partner/v1/apps-in-toss/user/oauth2/login-me`
- header: `Authorization: Bearer {accessToken}`
- 응답의 **userKey(number)** 가 우리 식별자. (앱 단위 고유, 같은 사용자라도 앱 다르면 다름)
- 이름·전화 등 개인정보는 암호화되어 옴(필요 시 콘솔의 복호화 키로 AES-256-GCM 복호화). **우리 서비스는 userKey만 쓰면 충분 → 개인정보 조회·복호화 불필요(최소 수집).**

### 4) 토큰 재발급
- POST `/api-partner/v1/apps-in-toss/user/oauth2/refresh-token`, body `{ refreshToken }`.
- accessToken 만료(1시간) 시 사용.

### 5) 연결 끊기 / 콜백
- userKey 또는 accessToken으로 연결 끊기 API 존재.
- 사용자가 토스앱에서 연결 해제 시 콜백(UNLINK/WITHDRAWAL_*) 수신 가능 → 해당 userKey 데이터 처리. (MVP: 선택, 최소 구현)

## 서버 보관 원칙
- accessToken/refreshToken은 **서버에서만** 보관(클라이언트 장기 저장 금지).
- 우리 DB에는 **userKey만** 저장(participants.user_key). 토큰은 메모리/단기 세션 처리, 개인정보 미저장.

## 선행 작업 체크 (콘솔 담당과 공유)
- [ ] 콘솔에서 토스 로그인 신청 + 약관/동의문 등록(이게 있어야 appLogin 동의 화면 동작)
- [ ] mTLS 인증서 발급·서버 적용
- [ ] 사업자 인증(대표관리자) 완료 — 토스 로그인 사용 전제 조건

## MVP 단순화
- 개인정보(이름/전화/생년월일/CI) 조회·복호화 안 함. userKey만.
- 토큰 저장소는 간단히(메모리 or 단기). 정교한 세션 스토어는 추후.
