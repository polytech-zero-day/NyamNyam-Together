// 토스 로그인 연동 — Deno Edge Function 버전
// mTLS는 Supabase Edge Runtime 미지원 → Cloudflare Worker(toss-mtls-proxy)가 대신 처리.
// ⚠️ 응답 봉투: { resultType: 'SUCCESS'|'FAIL', success: {...}|null, error: {errorCode, reason} }

// Cloudflare Worker가 mTLS를 대신 처리. Supabase Edge Runtime은 클라이언트 인증서 전송 불가.
const TOSS_BASE = 'https://toss-mtls-proxy.kkx7787.workers.dev/proxy';
const TOSS_TIMEOUT_MS = 10_000;

interface TossEnvelope<T> {
  resultType: 'SUCCESS' | 'FAIL';
  success: T | null;
  error: { errorType?: number; errorCode?: string; reason?: string } | null;
}

function unwrap<T>(data: TossEnvelope<T>): T {
  if (!data || data.resultType !== 'SUCCESS' || data.success == null) {
    const e = data?.error;
    throw new Error(`토스 API 실패: ${e?.errorCode ?? '?'} ${e?.reason ?? '알 수 없는 오류'}`);
  }
  return data.success;
}

async function tossPost<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${TOSS_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TOSS_TIMEOUT_MS),
  });
  return unwrap(await res.json() as TossEnvelope<T>);
}

async function tossGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${TOSS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TOSS_TIMEOUT_MS),
  });
  return unwrap(await res.json() as TossEnvelope<T>);
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

export async function exchangeAuthorizationCode(
  authorizationCode: string,
  referrer: string,
): Promise<TokenResponse> {
  return tossPost<TokenResponse>(
    '/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
    { authorizationCode, referrer },
  );
}

export async function getUserKey(accessToken: string): Promise<number> {
  const data = await tossGet<{ userKey: number }>(
    '/api-partner/v1/apps-in-toss/user/oauth2/login-me',
    accessToken,
  );
  return data.userKey;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  return tossPost<TokenResponse>(
    '/api-partner/v1/apps-in-toss/user/oauth2/refresh-token',
    { refreshToken },
  );
}
