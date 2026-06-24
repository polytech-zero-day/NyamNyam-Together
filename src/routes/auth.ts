// POST /auth/login  — 토스 인가코드 → userKey → JWT 발급
// POST /auth/anon   — 익명 참가자 토큰 발급
// POST /auth/dev-login — 개발 전용 테스트 토큰 (NODE_ENV=development만)

import { Router, Request, Response } from 'express';
import { exchangeAuthorizationCode, getUserKey } from '../services/tossLogin';
import { signToken, signAnonToken } from '../middleware/auth';
import { rateLimit } from '../middleware/rateLimit';

const router = Router();

// 익명 토큰 발급 남용 방지 — IP당 분당 20회
const anonLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  key: (req) => `ip:${req.ip ?? 'unknown'}`,
});

// POST /auth/anon — 익명 참가자 토큰 발급 (로그인 없이 링크로 입장하는 참여자용).
// host(그룹 생성·종료)는 /auth/login(토스) 필요. (integration-contract.md 인증 모델 B)
router.post('/anon', anonLimiter, (_req: Request, res: Response) => {
  const { token } = signAnonToken();
  res.json({ token });
});

// 개발 전용 — 토스 OAuth 없이 호스트 토큰 발급. 프로덕션에서는 라우트 자체가 등록되지 않는다.
if (process.env.NODE_ENV !== 'production') {
  router.post('/dev-login', (req: Request, res: Response) => {
    const userKey = parseInt(String((req.body as { userKey?: string })?.userKey ?? '1001'), 10);
    if (isNaN(userKey) || userKey <= 0) {
      res.status(400).json({ code: 'BAD_REQUEST', message: 'userKey는 양수 정수여야 합니다' });
      return;
    }
    res.json({ token: signToken(userKey), userKey });
  });
}

router.post('/login', async (req: Request, res: Response) => {
  const { authorizationCode, referrer } = req.body as {
    authorizationCode?: string;
    referrer?: string;
  };

  if (!authorizationCode || !referrer) {
    res
      .status(400)
      .json({ code: 'BAD_REQUEST', message: 'authorizationCode와 referrer가 필요합니다' });
    return;
  }

  try {
    const { accessToken } = await exchangeAuthorizationCode(authorizationCode, referrer);
    const userKey = await getUserKey(accessToken);
    // accessToken/refreshToken은 서버 메모리에서만 처리, DB 저장 안 함 (toss-login.md)
    const token = signToken(userKey);
    res.json({ token });
  } catch {
    res.status(401).json({ code: 'AUTH_FAILED', message: '토스 로그인에 실패했습니다' });
  }
});

export default router;
