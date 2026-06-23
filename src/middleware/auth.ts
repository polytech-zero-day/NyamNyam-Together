import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set');

// 인증 모델 (integration-contract.md): host=토스 userKey(양수), 참여자=익명(음수 id).
// 둘 다 user_key(bigint) 컬럼에 들어가며 음/양수로 구분 → 스키마 변경 불필요.
export type AuthKind = 'toss' | 'anon';

export interface AuthRequest extends Request {
  userKey?: number; // 토스 userKey(양수) 또는 익명 id(음수)
  authKind?: AuthKind;
}

interface TokenPayload {
  userKey: number;
  kind?: AuthKind;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: '인증이 필요합니다' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET!, { algorithms: ['HS256'] }) as TokenPayload;
    req.userKey = payload.userKey;
    req.authKind = payload.kind ?? 'toss'; // 구버전 토큰(kind 없음)은 토스로 간주
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다' });
  }
}

// 토스 식별 필수 (그룹 생성·종료 = host 권한). 익명 토큰은 거부.
export function requireToss(req: AuthRequest, res: Response, next: NextFunction): void {
  requireAuth(req, res, () => {
    if (req.authKind !== 'toss') {
      res.status(403).json({ code: 'TOSS_REQUIRED', message: '토스 로그인이 필요한 작업입니다' });
      return;
    }
    next();
  });
}

// 토스 host 토큰 (userKey = 토스 식별, 양수)
export function signToken(userKey: number): string {
  return jwt.sign({ userKey, kind: 'toss' }, JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' });
}

/**
 * 익명 참가자 토큰. 음수 랜덤 id를 user_key로 사용 — 토스 userKey(양수)와 충돌하지 않고
 * 세션 내 1인1표 dedup(unique(session_id, user_key, stage))에 그대로 쓰인다. (OAuth 불필요)
 */
export function signAnonToken(): { token: string; anonId: number } {
  // 음수 안전정수 범위 랜덤 (양수 토스 userKey와 절대 겹치지 않음)
  const anonId = -(Math.floor(Math.random() * 9_000_000_000_000) + 1);
  const token = jwt.sign({ userKey: anonId, kind: 'anon' }, JWT_SECRET!, {
    algorithm: 'HS256',
    expiresIn: '12h', // 참여자는 세션 동안 유지되도록 host보다 길게
  });
  return { token, anonId };
}
