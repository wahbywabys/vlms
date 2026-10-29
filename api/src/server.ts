import { pino } from 'pino';
import { createApp } from './app.js';
import { createPool } from './lib/db.js';
import { createRealtime } from './lib/redis.js';

const log = pino({ level: process.env.LOG_LEVEL ?? 'info' });
const jwtSecret = process.env.JWT_SECRET;
if (!jwtSecret || jwtSecret.length < 32) throw new Error('JWT_SECRET must be set (>= 32 chars)');

const db = createPool();
const realtime = createRealtime(process.env.REDIS_URL, log);
const port = Number(process.env.PORT ?? 4000);

createApp({ db, realtime, log, jwtSecret }).listen(port, () => log.info({ port }, 'VLMS API listening'));
