const TOSS_BASE = 'https://apps-in-toss-api.toss.im';

// 허용 경로 화이트리스트 — 토스 OAuth2 엔드포인트만 허용
const ALLOWED_PATHS = new Set([
  '/api-partner/v1/apps-in-toss/user/oauth2/generate-token',
  '/api-partner/v1/apps-in-toss/user/oauth2/login-me',
  '/api-partner/v1/apps-in-toss/user/oauth2/refresh-token',
]);

interface Env {
  TOSS_MTLS: Fetcher;
  PROXY_SECRET: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Supabase Edge Function만 아는 공유 시크릿 검증
    const secret = request.headers.get('X-Proxy-Secret');
    if (!env.PROXY_SECRET || secret !== env.PROXY_SECRET) {
      return new Response('Forbidden', { status: 403 });
    }

    const url = new URL(request.url);
    const path = url.pathname.replace(/^\/proxy/, '');

    // 허용된 경로만 포워딩
    if (!ALLOWED_PATHS.has(path)) {
      return new Response('Not Found', { status: 404 });
    }

    const target = `${TOSS_BASE}${path}`;

    // Host 헤더 제거 후 포워딩(토스 서버가 Host 불일치 거부 방지)
    const headers = new Headers(request.headers);
    headers.delete('Host');
    headers.delete('X-Proxy-Secret');

    const proxied = new Request(target, {
      method: request.method,
      headers,
      body: request.body,
    });

    return env.TOSS_MTLS.fetch(proxied);
  },
};
