// 토스 로그인 연동 — Deno Edge Function 버전
// mTLS 필수. TOSS_MTLS_CERT / TOSS_MTLS_KEY를 Supabase Secrets에 저장.
// ⚠️ 응답 봉투: { resultType: 'SUCCESS'|'FAIL', success: {...}|null, error: {errorCode, reason} }

const TOSS_BASE = 'https://apps-in-toss-api.toss.im';
const TOSS_TIMEOUT_MS = 10_000;

// mTLS 클라이언트: 첫 호출 시 초기화. 인증서 콘텐츠는 Supabase Secrets에서 환경변수로 주입.
let _httpClient: Deno.HttpClient | null = null;

function getMtlsClient(): Deno.HttpClient {
  if (_httpClient) return _httpClient;
  const certRaw = Deno.env.get('TOSS_MTLS_CERT');
  const keyRaw = Deno.env.get('TOSS_MTLS_KEY');
  if (!certRaw || !keyRaw) {
    throw new Error('TOSS_MTLS_CERT and TOSS_MTLS_KEY must be set in Supabase Secrets');
  }
  // Supabase Secrets CLI로 설정 시 base64 인코딩으로 저장 → 멀티라인 문제 회피.
  // base64 여부: '-----BEGIN' 미포함이면 base64로 간주.
  const certChain = certRaw.includes('-----BEGIN') ? certRaw : atob(certRaw);
  const privateKey = keyRaw.includes('-----BEGIN') ? keyRaw : atob(keyRaw);
  _httpClient = Deno.createHttpClient({ certChain, privateKey });
  return _httpClient;
}

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
    // @ts-ignore Deno HttpClient extension for mTLS
    client: getMtlsClient(),
  });
  return unwrap(await res.json() as TossEnvelope<T>);
}

async function tossGet<T>(path: string, accessToken: string): Promise<T> {
  const res = await fetch(`${TOSS_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(TOSS_TIMEOUT_MS),
    // @ts-ignore Deno HttpClient extension for mTLS
    client: getMtlsClient(),
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
