import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';

import authRouter from './routes/auth';
import sessionsRouter from './routes/sessions';
import participantsRouter from './routes/participants';
import votesRouter from './routes/votes';
import recommendRouter from './routes/recommend';

const app = express();
const PORT = process.env.PORT ?? 3000;

app.use(express.json());

// 라우트 (api-spec.md 기준)
app.use('/auth', authRouter);
app.use('/sessions', sessionsRouter);       // POST /, GET /:id, POST /:id/close, GET /:id/progress
app.use('/sessions', participantsRouter);   // POST /:id/join
app.use('/sessions', votesRouter);          // POST /:id/votes/stage1, stage2
app.use('/sessions', recommendRouter);      // GET /:id/recommendations

// 공통 에러 핸들러
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err);
  res.status(500).json({ code: 'INTERNAL_ERROR', message: '서버 오류가 발생했습니다' });
});

app.listen(PORT, () => {
  console.log(`NyamNyam-Together 서버 실행 중: http://localhost:${PORT}`);
});
