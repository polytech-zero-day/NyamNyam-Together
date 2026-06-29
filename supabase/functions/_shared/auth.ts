// @ts-types="npm:@types/jsonwebtoken"
import jwt from 'npm:jsonwebtoken';
import type { Context, Next } from 'npm:hono@4';
import { supabase } from './supabase.ts';

export type AuthKind = 'toss' | 'anon';

interface TokenPayload {
  userKey: number;
  kind?: AuthKind;
}

const JWT_SECRET = Deno.env.get('JWT_SECRET')!;

function extractToken(c: Context): string | null {
  const auth = c.req.header('Authorization');
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}

export const requireAuth = async (c: Context, next: Next): Promise<Response | void> => {
  const token = extractToken(c);
  if (!token) return c.json({ code: 'UNAUTHORIZED', message: '인증이 필요합니다' }, 401);
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return c.json({ code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다' }, 401);
  }
  c.set('userKey', payload.userKey);
  c.set('authKind', payload.kind ?? 'toss');
  // next()는 try 밖에서 호출 — 다운스트림 핸들러 에러를 토큰 오류(401)로 가리지 않도록.
  await next();
};

export const requireToss = async (c: Context, next: Next): Promise<Response | void> => {
  const token = extractToken(c);
  if (!token) return c.json({ code: 'UNAUTHORIZED', message: '인증이 필요합니다' }, 401);
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return c.json({ code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다' }, 401);
  }
  const kind = payload.kind ?? 'toss';
  if (kind !== 'toss') {
    return c.json({ code: 'TOSS_REQUIRED', message: '토스 로그인이 필요한 작업입니다' }, 403);
  }
  c.set('userKey', payload.userKey);
  c.set('authKind', 'toss');
  // next()는 try 밖에서 호출 — 다운스트림 핸들러 에러를 토큰 오류(401)로 가리지 않도록.
  await next();
};

// 세션 멤버십 인가: 요청자가 :id 세션의 참여자인지 확인.
export const requireParticipant = async (c: Context, next: Next): Promise<Response | void> => {
  const token = extractToken(c);
  if (!token) return c.json({ code: 'UNAUTHORIZED', message: '인증이 필요합니다' }, 401);
  let payload: TokenPayload;
  try {
    payload = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as TokenPayload;
  } catch {
    return c.json({ code: 'UNAUTHORIZED', message: '유효하지 않은 토큰입니다' }, 401);
  }
  c.set('userKey', payload.userKey);
  c.set('authKind', payload.kind ?? 'toss');

  const sessionId = c.req.param('id');
  const { data } = await supabase
    .from('participants')
    .select('id')
    .eq('session_id', sessionId)
    .eq('user_key', payload.userKey)
    .maybeSingle();

  if (!data) {
    return c.json({ code: 'NOT_PARTICIPANT', message: '세션 참여자만 접근할 수 있습니다' }, 403);
  }
  await next();
};

export function signToken(userKey: number): string {
  return jwt.sign({ userKey, kind: 'toss' }, JWT_SECRET, { algorithm: 'HS256', expiresIn: '1h' });
}

export function signAnonToken(): { token: string; anonId: number } {
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);
  const anonId = -(((arr[0] * 0x100000000 + arr[1]) % 9_000_000_000_000) + 1);
  const token = jwt.sign({ userKey: anonId, kind: 'anon' }, JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: '12h',
  });
  return { token, anonId };
}
