import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set');

export interface AuthRequest extends Request {
  userKey?: number;
}

export function requireAuth(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ code: 'UNAUTHORIZED', message: '인증이 필요합니다' });
    return;
  }
  const token = authHeader.slice(7);
  try {
    const payload = jwt.verify(token, JWT_SECRET!, { algorithms: ['HS256'] }) as {
      userKey: number;
    };
    req.userKey = payload.userKey;
    next();
  } catch {
    res.status(401).json({ code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다' });
  }
}

export function signToken(userKey: number): string {
  return jwt.sign({ userKey }, JWT_SECRET!, { algorithm: 'HS256', expiresIn: '1h' });
}
