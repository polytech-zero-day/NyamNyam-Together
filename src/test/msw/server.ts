// Vitest(node) 환경용 MSW 서버. 브라우저(Storybook)는 서비스워커를 별도로 쓴다.
import { setupServer } from "msw/node";
import { handlers } from "./handlers";

export const server = setupServer(...handlers);
