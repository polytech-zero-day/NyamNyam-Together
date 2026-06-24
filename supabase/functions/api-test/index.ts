import { Hono } from 'npm:hono@4';

const app = new Hono();

app.get('/ping', (c) => c.json({ pong: true, path: new URL(c.req.url).pathname }));
app.all('*', (c) => c.json({ catchAll: true, path: new URL(c.req.url).pathname, method: c.req.method }));

export default { fetch: app.fetch.bind(app) };
