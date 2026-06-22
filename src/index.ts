import 'dotenv/config';
import 'express-async-errors'; // Express 4 async 핸들러 reject → 에러 미들웨어로 전달
import fs from 'fs';
import path from 'path';
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import yaml from 'js-yaml';

import authRouter from './routes/auth';
import sessionsRouter from './routes/sessions';
import participantsRouter from './routes/participants';
import votesRouter from './routes/votes';
import recommendRouter from './routes/recommend';

const app = express();
const PORT = process.env.PORT ?? 3000;

// CORS — 프론트(토스 WebView)는 cross-origin. CORS_ORIGIN(쉼표구분)으로 제한, 없으면 전체 허용.
// Bearer 토큰 인증이라 쿠키 미사용 → credentials 불필요.
const corsOrigin = process.env.CORS_ORIGIN?.split(',').map((s) => s.trim());
app.use(cors({ origin: corsOrigin && corsOrigin.length > 0 ? corsOrigin : true }));

app.use(express.json());

// 헬스체크 (배포 liveness probe)
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok' });
});

// API 문서 (Swagger UI) — docs/openapi.yaml 기준. GET /docs
// 스펙 로딩 실패가 서버 부팅을 막지 않도록 가드(문서만 비활성화).
try {
  const openapiPath = path.join(__dirname, '..', 'docs', 'openapi.yaml');
  const openapiSpec = yaml.load(fs.readFileSync(openapiPath, 'utf8')) as swaggerUi.JsonObject;
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapiSpec));
} catch (err) {
  console.error('OpenAPI 스펙 로딩 실패 — /docs 비활성화:', (err as Error).message);
}

// 라우트 (api-spec.md 기준)
app.use('/auth', authRouter);
app.use('/sessions', sessionsRouter); // POST /, GET /:id, POST /:id/close, GET /:id/progress
app.use('/sessions', participantsRouter); // POST /:id/join
app.use('/sessions', votesRouter); // POST /:id/votes/stage1, stage2
app.use('/sessions', recommendRouter); // GET /:id/recommendations

// 공통 에러 핸들러

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' });
});

const server = app.listen(PORT, () => {
  console.log(`NyamNyam-Together 서버 실행 중: http://localhost:${PORT}`);
});

// Graceful shutdown — 재배포/종료 시 진행 중 요청 드레인
for (const sig of ['SIGTERM', 'SIGINT'] as const) {
  process.on(sig, () => {
    console.log(`${sig} 수신 — 서버 종료 중...`);
    server.close(() => process.exit(0));
  });
}
