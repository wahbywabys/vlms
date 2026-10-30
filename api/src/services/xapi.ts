/**
 * xAPI 1.0.3 statements from the records VTC_LMS already keeps, for export
 * to an institutional LRS. V-Lab telemetry is stored xAPI-shaped (verb +
 * object + result value), so it maps one to one; floor observations, OJT
 * check-ins and machine pre-checks are mapped to ADL / TinCan verbs.
 */
import { createHash } from 'node:crypto';
import type { Db } from '../lib/db.js';

const BASE = process.env.XAPI_BASE_IRI ?? 'https://vtc-lms.example/xapi';
const ADL = 'http://adlnet.gov/expapi/verbs/';
const verbIri = (v: string) =>
  ['attempted', 'completed', 'passed', 'failed', 'scored', 'experienced', 'answered'].includes(v) ? `${ADL}${v}` : `${BASE}/verbs/${v}`;

export interface Statement {
  id?: string;
  actor: { objectType: 'Agent'; account: { homePage: string; name: string }; name?: string };
  verb: { id: string; display: { 'en-US': string } };
  object: { objectType: 'Activity'; id: string; definition?: { name?: Record<string, string>; type?: string } };
  result?: Record<string, unknown>;
  context?: Record<string, unknown>;
  timestamp: string;
}

/** A stable statement id (UUID v5 layout) so an export can be resent and an LRS or the cloud hub keeps one copy. */
export function statementId(kind: string, uid: string, verb: string) {
  const h = createHash('sha1').update(`vtc-lms/${kind}/${uid}/${verb}`).digest();
  h[6] = (h[6]! & 0x0f) | 0x50;
  h[8] = (h[8]! & 0x3f) | 0x80;
  const x = h.subarray(0, 16).toString('hex');
  return `${x.slice(0, 8)}-${x.slice(8, 12)}-${x.slice(12, 16)}-${x.slice(16, 20)}-${x.slice(20)}`;
}

export interface StatementQuery {
  /** One institution, or every institution on this server (the centre uplink). */
  institutionId: string | null;
  since: Date;
  limit: number;
  /**
   * 'occurred' (default) pages by when it happened. 'received' pages by when
   * this server stored it, inclusively, so a check-in replayed from an
   * offline phone days later is still picked up by a cursor that has moved on.
   */
  by?: 'occurred' | 'received';
}

export async function toStatements(db: Db, institutionId: string, since: Date, limit: number): Promise<Statement[]> {
  return (await queryStatements(db, { institutionId, since, limit })).map((r) => r.statement);
}

export async function queryStatements(db: Db, q: StatementQuery): Promise<{ statement: Statement; receivedAt: Date }[]> {
  const t = q.by === 'received' ? 'seen' : 'at';
  const cmp = q.by === 'received' ? '>=' : '>';
  const { rows } = await db.query<{ kind: string; learner_id: string; learner: string; verb: string; object: string; label: string | null;
    value: Record<string, unknown> | null; at: Date; seen: Date; ref: string; uid: string }>(
    `SELECT * FROM (
       SELECT 'vlab' AS kind, s.learner_id, u.full_name AS learner, t.verb, l.code || '/' || COALESCE(t.object_ref, 'scene') AS object,
              l.title AS label, t.value, t.occurred_at AS at, t.received_at AS seen, s.id::text AS ref, s.id || ':' || t.seq AS uid
         FROM vlab_telemetry t JOIN virtual_lab_sessions s ON s.id = t.session_id JOIN virtual_labs l ON l.id = s.lab_id JOIN users u ON u.id = s.learner_id
       UNION ALL
       SELECT 'observation', e.learner_id, u.full_name, CASE WHEN e.passed THEN 'passed' ELSE 'failed' END, 'rubric/' || r.code,
              r.title, jsonb_build_object('score', e.total_score, 'gates', e.gate_failures), e.evaluated_at, e.evaluated_at, e.subject_id::text, e.id::text
         FROM rubric_evaluations e JOIN rubrics r ON r.id = e.rubric_id JOIN users u ON u.id = e.learner_id
        WHERE e.subject_type = 'workshop_observation'
       UNION ALL
       SELECT 'ojt', pl.learner_id, u.full_name, CASE c.kind WHEN 'in' THEN 'checked-in' ELSE 'checked-out' END, 'site/' || pl.site_id,
              es.name, jsonb_build_object('inside', c.inside_geofence, 'distance_m', round(c.distance_m)), c.device_time, c.server_time, c.id::text, c.id::text
         FROM wbl_checkins c JOIN wbl_placements pl ON pl.id = c.placement_id JOIN employer_sites es ON es.id = pl.site_id JOIN users u ON u.id = pl.learner_id
        WHERE c.accepted
       UNION ALL
       SELECT 'precheck', a.learner_id, u.full_name, CASE WHEN a.passed THEN 'passed' ELSE 'failed' END, 'machine/' || w.asset_tag || '/precheck',
              pc.title, jsonb_build_object('score', a.score, 'critical_missed', a.critical_missed), a.submitted_at, a.submitted_at, a.id::text, a.id::text
         FROM safety_precheck_attempts a JOIN safety_prechecks pc ON pc.id = a.precheck_id JOIN workshop_assets w ON w.id = a.asset_id
         JOIN users u ON u.id = a.learner_id
        WHERE a.submitted_at IS NOT NULL
     ) x
     WHERE ${t} ${cmp} $2 AND ($1::uuid IS NULL OR EXISTS (SELECT 1 FROM users u WHERE u.id = x.learner_id AND u.institution_id = $1))
     ORDER BY ${t}, uid LIMIT $3`, [q.institutionId, q.since, q.limit]);

  return rows.map((r) => ({ receivedAt: new Date(r.seen), statement: toStatement(r) }));
}

function toStatement(r: { kind: string; learner_id: string; learner: string; verb: string; object: string; label: string | null;
  value: Record<string, unknown> | null; at: Date; ref: string; uid: string }): Statement {
  const v = r.value ?? {};
  const score = typeof v['score'] === 'number' || typeof v['score'] === 'string' ? Number(v['score']) : null;
  return {
    id: statementId(r.kind, r.uid, r.verb),
    actor: { objectType: 'Agent', account: { homePage: BASE, name: r.learner_id }, name: r.learner },
    verb: { id: verbIri(r.verb), display: { 'en-US': r.verb } },
    object: { objectType: 'Activity', id: `${BASE}/activities/${r.object}`, definition: { ...(r.label ? { name: { 'en-US': r.label } } : {}), type: `${BASE}/types/${r.kind}` } },
    ...(score !== null ? { result: { score: { scaled: Math.max(0, Math.min(1, score / 100)), raw: score, min: 0, max: 100 }, success: r.verb === 'passed', extensions: { [`${BASE}/ext/detail`]: v } } }
      : Object.keys(v).length ? { result: { extensions: { [`${BASE}/ext/value`]: v } } } : {}),
    context: { extensions: { [`${BASE}/ext/ref`]: r.ref } },
    timestamp: new Date(r.at).toISOString(),
  };
}
