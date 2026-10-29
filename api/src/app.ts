import express, { type ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { requireAuth } from './lib/auth.js';
import type { Db } from './lib/db.js';
import { HttpError } from './lib/errors.js';
import type { Realtime } from './lib/redis.js';
import { vlabSessionsRouter } from './routes/vlabSessions.js';

export function createApp(deps: { db: Db; realtime: Realtime; log: Logger; jwtSecret: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', async (_req, res) => {
    await deps.db.query('SELECT 1');
    res.json({ ok: true });
  });

  app.use(requireAuth(deps.jwtSecret));
  app.use(vlabSessionsRouter(deps));

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_request', issues: err.issues });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    } else if (err?.type === 'entity.parse.failed') {
      res.status(400).json({ error: 'invalid_json' });
    } else {
      deps.log.error({ err, path: req.path }, 'unhandled error');
      res.status(500).json({ error: 'internal' });
    }
  };
  app.use(onError);
  return app;
}
