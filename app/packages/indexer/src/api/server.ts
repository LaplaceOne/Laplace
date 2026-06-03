import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Db } from '../db/client.js';
import { listIntents, getIntent } from '../queries/intents.js';
import { stats } from '../queries/stats.js';
import { listValidityConfigs } from '../queries/configs.js';

export function createApi(db: Db): Hono {
  const app = new Hono();
  app.use('*', cors());
  app.get('/health', (c) => c.json({ ok: true }));

  app.get('/intents', async (c) => {
    const q = c.req.query();
    const intents = await listIntents(db, {
      status: q.status, maker: q.maker, receiver: q.receiver, criterionProgram: q.criterion,
      limit: Math.min(Number(q.limit ?? '50'), 200),
      cursorSlot: q.cursorSlot ? Number(q.cursorSlot) : undefined,
    });
    return c.json({ intents });
  });

  app.get('/intents/:pda', async (c) => {
    const detail = await getIntent(db, c.req.param('pda'));
    if (!detail) return c.json({ error: 'not found' }, 404);
    return c.json(detail);
  });

  app.get('/stats', async (c) => c.json(await stats(db)));
  app.get('/validity-configs', async (c) => c.json({ configs: await listValidityConfigs(db) }));
  return app;
}
