// 인증 토큰(JWT) 보관소. 백엔드가 발급한 자체 JWT를 메모리 + sessionStorage에 둔다.
//   · host  : 토스 appLogin → /auth/login 으로 받은 토큰(userKey 기반, 양수)
//   · 참여자: /auth/anon 으로 받은 익명 토큰(음수 id)
// client.ts는 이 토큰을 Authorization: Bearer 로 자동 첨부한다.
// (client ↔ auth 순환 의존을 피하려고 토큰 저장만 별도 모듈로 분리)
const STORAGE_KEY = "nnt_token";

function read(): string | null {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage.getItem(STORAGE_KEY) : null;
  } catch {
    return null;
  }
}

let token: string | null = read();

export function getToken(): string | null {
  return token;
}

export function setToken(next: string): void {
  token = next;
  try {
    sessionStorage.setItem(STORAGE_KEY, next);
  } catch {
    // sessionStorage 불가 환경(웹뷰 제약 등)에서는 메모리 보관만 유지
  }
}

export function clearToken(): void {
  token = null;
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // no-op
  }
}

export function hasToken(): boolean {
  return token != null && token !== "";
}
