// 토스 로그인 연동 (toss-login.md)
// mTLS 필수. 서버에서만 사용. userKey만 저장(개인정보 최소 수집).

import axios from 'axios';
import https from 'https';
import fs from 'fs';

const TOSS_BASE = 'https://apps-in-toss-api.toss.im';

// mTLS 에이전트: 최초 호출 시 생성 (인증서 파일 lazy 로드)
let _httpsAgent: https.Agent | null = null;

function getMtlsAgent(): https.Agent {
  if (_httpsAgent) return _httpsAgent;
  const certPath = process.env.TOSS_MTLS_CERT_PATH;
  const keyPath = process.env.TOSS_MTLS_KEY_PATH;
  if (!certPath || !keyPath) {
    throw new Error('TOSS_MTLS_CERT_PATH and TOSS_MTLS_KEY_PATH must be set');
  }
  _httpsAgent = new https.Agent({
    cert: fs.readFileSync(certPath),
    key: fs.readFileSync(keyPath),
  });
  return _httpsAgent;
}

function tossClient() {
  return axios.create({
    baseURL: TOSS_BASE,
    httpsAgent: getMtlsAgent(),
  });
}

interface TokenResponse {
  accessToken: string;
  refreshToken: string;
}

// 인가코드 → AccessToken/RefreshToken 교환 (mTLS 서버 간 통신)
export async function exchangeAuthorizationCode(
  authorizationCode: string,
  referrer: string,
): Promise<TokenResponse> {
  const res = await tossClient().post('/api-partner/v1/apps-in-toss/user/oauth2/generate-token', {
    authorizationCode,
    referrer,
  });
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
  };
}

// AccessToken → userKey 조회 (앱 단위 고유 식별자)
// 개인정보(이름/전화 등) 조회·복호화는 하지 않음 (toss-login.md MVP 단순화)
export async function getUserKey(accessToken: string): Promise<number> {
  const res = await tossClient().get('/api-partner/v1/apps-in-toss/user/oauth2/login-me', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return res.data.userKey as number;
}

// AccessToken 만료 시 재발급
export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const res = await tossClient().post('/api-partner/v1/apps-in-toss/user/oauth2/refresh-token', {
    refreshToken,
  });
  return {
    accessToken: res.data.accessToken,
    refreshToken: res.data.refreshToken,
  };
}
