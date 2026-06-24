// 경량 인메모리 레이트리밋 (무의존성). 고정 윈도우 카운터.
// 목적: 유료 구글 호출 경로·토큰 발급·등록 쓰기 남용 방지(리뷰 P0/P1).
// ⚠️ 단일 인스턴스 기준(MVP). 다중 인스턴스 배포 시 공유 스토어(Redis 등)로 교체 필요.

import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  windowMs: number;
  max: number;
  key?: (req: AuthRequest) => string; // 미지정 시 userKey > ip 순
}

// 인증된 요청은 userKey, 아니면 ip로 키잉
function defaultKey(req: AuthRequest): string {
  if (req.userKey != null) return `u:${req.userKey}`;
  return `ip:${req.ip ?? 'unknown'}`;
}

export function rateLimit(opts: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  const keyOf = opts.key ?? defaultKey;

  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const k = keyOf(req);
    let b = buckets.get(k);
    if (!b || b.resetAt <= now) {
      b = { count: 0, resetAt: now + opts.windowMs };
      buckets.set(k, b);
      // 만료 버킷 lazy 정리(메모리 누수 방지) — 새 버킷 생성 시 가끔 스윕
      if (buckets.size > 5_000) {
        for (const [key, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(key);
      }
    }
    b.count += 1;
    if (b.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((b.resetAt - now) / 1000)));
      res
        .status(429)
        .json({ code: 'RATE_LIMITED', message: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요' });
      return;
    }
    next();
  };
}
