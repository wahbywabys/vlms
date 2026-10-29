/**
 * Photo and video evidence (floor tablet, apprentice logbook, signatures)
 *
 *   POST /v1/media        raw image/* or video/* body; metadata in headers
 *   GET  /v1/media/:id    the file, for people allowed to see it
 *
 * Upload headers: X-Client-Mutation-Id (idempotent retries from the offline
 * queue), X-Captured-At (device time of capture), optional X-Kind
 * (photo|video|signature), X-Width, X-Height, X-Duration-Ms, X-Lat, X-Lon.
 * The server computes the SHA-256 that sign-offs and observations reference.
 * The demo stores bytes in Postgres; set storage_uri to an object store in
 * production and drop `data`.
 */
import { createHash } from 'node:crypto';
import express, { Router, type Request } from 'express';
import { z } from 'zod';
import { isStaff } from '../lib/auth.js';
import type { Db } from '../lib/db.js';
import { HttpError, notFound } from '../lib/errors.js';

const MAX_BYTES = 25 * 1024 * 1024;
const num = (v: string | undefined) => (v === undefined || v === '' ? null : Number.isFinite(Number(v)) ? Number(v) : null);

export function mediaRouter(deps: { db: Db }) {
  const router = Router();

  router.post('/v1/media', express.raw({ type: ['image/*', 'video/*'], limit: MAX_BYTES }), async (req: Request, res) => {
    const p = req.principal!;
    const body = req.body as Buffer;
    if (!Buffer.isBuffer(body) || body.length === 0) throw new HttpError(415, 'unsupported_media', 'Send an image/* or video/* body');
    const mime = String(req.headers['content-type']).split(';')[0]!.trim().toLowerCase();
    const mutation = z.string().uuid().parse(req.header('x-client-mutation-id'));
    const kind = z.enum(['photo', 'video', 'signature']).parse(req.header('x-kind') ?? (mime.startsWith('video/') ? 'video' : 'photo'));
    const captured = z.coerce.date().parse(req.header('x-captured-at') ?? new Date().toISOString());
    const sha = createHash('sha256').update(body).digest('hex');

    const { rows } = await deps.db.query<{ id: string; replayed: boolean }>(
      `INSERT INTO media_objects (institution_id, owner_id, kind, mime, bytes, sha256, width, height, duration_ms, captured_at,
                                  latitude, longitude, data, client_mutation_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
       ON CONFLICT (client_mutation_id) DO UPDATE SET client_mutation_id = EXCLUDED.client_mutation_id
       RETURNING id, (xmax <> 0) AS replayed`,
      [p.institutionId, p.userId, kind, mime, body.length, sha, num(req.header('x-width')), num(req.header('x-height')),
        num(req.header('x-duration-ms')), captured, num(req.header('x-lat')), num(req.header('x-lon')), body, mutation]);
    res.status(rows[0]!.replayed ? 200 : 201).json({ id: rows[0]!.id, sha256: sha, bytes: body.length, mime, kind, capturedAt: captured });
  });

  router.get('/v1/media/:id', async (req: Request, res) => {
    const p = req.principal!;
    const id = z.string().uuid().parse(req.params['id']);
    const { rows } = await deps.db.query<{ owner_id: string; mime: string; data: Buffer | null; storage_uri: string | null; sha256: string }>(
      `SELECT owner_id, mime, data, storage_uri, sha256 FROM media_objects WHERE id = $1 AND institution_id = $2`, [id, p.institutionId]);
    const m = rows[0];
    const canSee = m && (m.owner_id === p.userId || isStaff(p) || p.roles.includes('director') || p.roles.includes('industry_supervisor'));
    if (!m || !canSee) throw notFound('Media');
    if (!m.data) { res.redirect(302, m.storage_uri!); return; }
    res.setHeader('content-type', m.mime);
    res.setHeader('cache-control', 'private, max-age=86400, immutable');
    res.setHeader('etag', `"${m.sha256}"`);
    res.end(m.data);
  });

  return router;
}
