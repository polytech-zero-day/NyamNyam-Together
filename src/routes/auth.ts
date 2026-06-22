// POST /auth/login (api-spec.md)
// 토스 인가코드 → userKey → JWT 발급

import { Router, Request, Response } from 'express';
import { exchangeAuthorizationCode, getUserKey } from '../services/tossLogin';
import { signToken } from '../middleware/auth';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  const { authorizationCode, referrer } = req.body as {
    authorizationCode?: string;
    referrer?: string;
  };

  if (!authorizationCode || !referrer) {
    res.status(400).json({ code: 'BAD_REQUEST', message: 'authorizationCode와 referrer가 필요합니다' });
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
