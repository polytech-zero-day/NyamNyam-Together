// express-async-errors는 타입을 제공하지 않음. 사이드이펙트 import만 사용.
// (Express 4의 async 라우트 핸들러 reject를 에러 미들웨어로 전달하도록 패치)
declare module 'express-async-errors';
