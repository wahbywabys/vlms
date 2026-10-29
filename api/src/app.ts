import express, { type ErrorRequestHandler } from 'express';
import type { Logger } from 'pino';
import { ZodError } from 'zod';
import { requireAuth } from './lib/auth.js';
import type { Db } from './lib/db.js';
import { HttpError } from './lib/errors.js';
import type { Realtime } from './lib/redis.js';
import { alertsRouter } from './routes/alerts.js';
import { analyticsRouter } from './routes/analytics.js';
import { assessmentsRouter } from './routes/assessments.js';
import { inventoryRouter } from './routes/inventory.js';
import { logbookRouter } from './routes/logbook.js';
import { mediaRouter } from './routes/media.js';
import { observationsRouter } from './routes/observations.js';
import { ojtRouter } from './routes/ojt.js';
import { machineControllerRouter, safetyRouter } from './routes/safety.js';
import { syncRouter } from './routes/sync.js';
import { vlabSessionsRouter } from './routes/vlabSessions.js';

export function createApp(deps: { db: Db; realtime: Realtime; log: Logger; jwtSecret: string }) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get('/healthz', async (_req, res) => {
    await deps.db.query('SELECT 1');
    res.json({ ok: true });
  });

  // Machine interlocks authenticate with their own key, not a user token.
  app.use(machineControllerRouter(deps));

  app.use(requireAuth(deps.jwtSecret));
  app.use(vlabSessionsRouter(deps));
  app.use(alertsRouter(deps));
  app.use(observationsRouter(deps));
  app.use(safetyRouter(deps));
  app.use(ojtRouter(deps));
  app.use(logbookRouter(deps));
  app.use(mediaRouter(deps));
  app.use(inventoryRouter(deps));
  app.use(assessmentsRouter(deps));
  app.use(analyticsRouter(deps));
  app.use(syncRouter(deps));

  const onError: ErrorRequestHandler = (err, req, res, _next) => {
    if (err instanceof ZodError) {
      res.status(400).json({ error: 'invalid_request', issues: err.issues });
    } else if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.code, message: err.message, details: err.details });
    } else if (err?.type === 'entity.too.large') {
      res.status(413).json({ error: 'too_large' });
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
