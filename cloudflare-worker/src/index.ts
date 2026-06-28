const TOSS_BASE = 'https://apps-in-toss-api.toss.im';

interface Env {
  TOSS_MTLS: Fetcher;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // /proxy/* → TOSS_BASE/* 로 포워딩
    const path = url.pathname.replace(/^\/proxy/, '');
    const target = `${TOSS_BASE}${path}`;

    const proxied = new Request(target, {
      method: request.method,
      headers: request.headers,
      body: request.body,
    });

    return env.TOSS_MTLS.fetch(proxied);
  },
};
