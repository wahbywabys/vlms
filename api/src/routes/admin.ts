/**
 * Administration: programmes and their skills, centres, and the real machine register
 *
 *   GET  /v1/admin/programs                    every programme (trade) with its competency tree
 *   PUT  /v1/admin/programs/:id                add or rename a programme
 *   POST /v1/admin/programs/:id/competencies   add or edit one skill (unit, element or criterion)
 *   POST /v1/admin/programs/import             many rows at once, from the Excel/CSV template
 *   GET  /v1/admin/machine-types               machine types and the 3D twin each one maps to
 *   GET  /v1/admin/centers                     centres with their workshops and machine counts
 *   GET  /v1/admin/machines                    the machine register (every real machine)
 *   POST /v1/admin/machines/import             register machines from the inventory template
 *
 * Directors and admins only. Imports apply row by row (a bad row is reported
 * and the rest go on) and accept {dryRun:true} to check a file without saving.
 * The browser reads the .xlsx/.csv and posts its rows as JSON; photos are
 * uploaded first through POST /v1/media and referenced by id.
 */
import { randomBytes } from 'node:crypto';
import { Router, type Request } from 'express';
import { z, ZodError } from 'zod';
import type { Principal } from '../lib/auth.js';
import { withTx, type Db, type Tx } from '../lib/db.js';
import { forbidden, HttpError, notFound } from '../lib/errors.js';

const isAdmin = (p: Principal) => p.roles.includes('director') || p.roles.includes('admin');
const KINDS = ['unit', 'element', 'criterion'] as const;
const PARENT_KIND = { unit: null, element: 'unit', criterion: 'element' } as const;

const blank = (v: unknown) => (v === undefined || v === null || (typeof v === 'string' && v.trim() === '') ? undefined : v);
const str = (max: number) => z.preprocess((v) => (typeof v === 'number' ? String(v) : blank(v)), z.string().trim().max(max).optional());
const req = (max: number) => z.preprocess((v) => (typeof v === 'number' ? String(v) : blank(v)), z.string().trim().min(1).max(max));
const yes = z.preprocess((v) => {
  if (typeof v === 'boolean') return v;
  const s = String(blank(v) ?? '').trim().toLowerCase();
  return ['yes', 'y', 'true', '1', 'نعم', 'x', '✓'].includes(s);
}, z.boolean());
const num = (min: number, max: number) => z.preprocess((v) => (blank(v) === undefined ? undefined : Number(v)), z.number().min(min).max(max).optional());
const code = (max: number) => z.preprocess((v) => (typeof v === 'number' ? String(v) : blank(v)),
  z.string().trim().min(1).max(max).regex(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/, 'letters, digits, - _ . only'));

/** Programme id ('plumb') from its code ('PLUMB'). */
export const programId = (c: string) => {
  const id = c.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 24);
  return /^[a-z]/.test(id) ? id : `p${id}`.slice(0, 24);
};

interface TradeRow { id: string; code: string; name: string; name_ar: string | null }

async function upsertProgram(tx: Tx, c: string, name: string | undefined, nameAr: string | undefined): Promise<{ trade: TradeRow; created: boolean }> {
  // A programme is found by its code, the curriculum manual's code ('ELI' for the electrical trade) or its id.
  const found = await tx.query<TradeRow>(
    `SELECT id, code, name, name_ar FROM trades WHERE upper(code) = upper($1) OR upper(program_code) = upper($1) OR id = $2
      ORDER BY (upper(code) = upper($1)) DESC LIMIT 1`, [c, programId(c)]);
  if (found.rows[0]) {
    const t = found.rows[0];
    if ((name && name !== t.name) || (nameAr && nameAr !== t.name_ar)) {
      const u = await tx.query<TradeRow>(`UPDATE trades SET name = COALESCE($2, name), name_ar = COALESCE($3, name_ar) WHERE id = $1 RETURNING id, code, name, name_ar`,
        [t.id, name ?? null, nameAr ?? null]);
      return { trade: u.rows[0]!, created: false };
    }
    return { trade: t, created: false };
  }
  if (!name) throw new HttpError(400, 'name_required', `Programme ${c} is new: give it a name`);
  const id = programId(c);
  if (!/^[a-z][a-z0-9_]{1,23}$/.test(id)) throw new HttpError(400, 'bad_code', `Programme code ${c} is too short`);
  const t = await tx.query<TradeRow>(
    `INSERT INTO trades (id, code, name, name_ar, sort_order) VALUES ($1, upper($2), $3, $4, (SELECT COALESCE(max(sort_order), 0) + 10 FROM trades))
     RETURNING id, code, name, name_ar`, [id, c, name, nameAr ?? null]);
  return { trade: t.rows[0]!, created: true };
}

/** The framework a programme's skills live in; made on first use. */
async function frameworkOf(tx: Tx, t: TradeRow): Promise<string> {
  const f = await tx.query<{ id: string }>(`SELECT id FROM competency_frameworks WHERE trade_id = $1 ORDER BY effective_from DESC, code LIMIT 1`, [t.id]);
  if (f.rows[0]) return f.rows[0].id;
  const n = await tx.query<{ id: string }>(
    `INSERT INTO competency_frameworks (code, title, issuing_body, version, effective_from, trade_id)
     VALUES ($1, $2, 'Institution programme', '1', current_date, $3)
     ON CONFLICT (code) DO UPDATE SET trade_id = EXCLUDED.trade_id RETURNING id`, [`${t.code}-PROG`, `${t.name} programme`, t.id]);
  return n.rows[0]!.id;
}

/** Knowledge / skill / attitude, from 'K', 'Skill', 'معرفة'… */
const KSA_WORDS: Record<string, 'K' | 'S' | 'A'> = {
  k: 'K', knowledge: 'K', 'معرفة': 'K', 'معرفي': 'K', s: 'S', skill: 'S', skills: 'S', 'مهارة': 'S', 'مهاري': 'S',
  a: 'A', attitude: 'A', attitudes: 'A', 'اتجاه': 'A', 'سلوك': 'A', 'سلوكي': 'A',
};
const ksa = z.preprocess((v) => {
  const s = String(blank(v) ?? '').trim().toLowerCase();
  return s ? (KSA_WORDS[s] ?? s) : undefined;
}, z.enum(['K', 'S', 'A']).optional());

const Competency = z.object({
  code: code(60), kind: z.preprocess((v) => (typeof v === 'string' ? v.trim().toLowerCase() : v), z.enum(KINDS)),
  parentCode: z.preprocess(blank, code(60).optional()), title: req(300), titleAr: str(300),
  safetyCritical: yes.default(false), hours: num(0, 9999),
  ksa, year: num(1, 6), targetLevel: str(20), coreAttitude: z.preprocess(blank, z.string().trim().regex(/^A[0-9]$/, 'A1 to A7').optional()),
  description: str(4000), descriptionAr: str(4000),
});
type CompetencyIn = z.infer<typeof Competency>;

async function upsertCompetency(tx: Tx, frameworkId: string, c: CompetencyIn): Promise<'created' | 'updated'> {
  let parentId: string | null = null;
  const want = PARENT_KIND[c.kind];
  if (want) {
    if (!c.parentCode) throw new HttpError(400, 'parent_required', `A ${c.kind} needs a parent ${want} code`);
    const p = await tx.query<{ id: string; kind: string }>(`SELECT id, kind FROM competencies WHERE framework_id = $1 AND upper(code) = upper($2)`, [frameworkId, c.parentCode]);
    if (!p.rows[0]) throw new HttpError(400, 'parent_missing', `Parent ${c.parentCode} is not in this programme (list it above this row)`);
    if (p.rows[0].kind !== want) throw new HttpError(400, 'parent_kind', `The parent of a ${c.kind} must be a ${want}; ${c.parentCode} is a ${p.rows[0].kind}`);
    parentId = p.rows[0].id;
  } else if (c.parentCode) throw new HttpError(400, 'unit_parent', 'A unit has no parent; leave Parent code empty');
  const { rows } = await tx.query<{ inserted: boolean }>(
    `INSERT INTO competencies (framework_id, parent_id, code, title, title_ar, kind, is_safety_critical, nominal_hours,
                               ksa, year, target_level, core_attitude, description, description_ar)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
     ON CONFLICT (framework_id, code) DO UPDATE SET parent_id = EXCLUDED.parent_id, title = EXCLUDED.title,
       title_ar = COALESCE(EXCLUDED.title_ar, competencies.title_ar), kind = EXCLUDED.kind,
       is_safety_critical = EXCLUDED.is_safety_critical, nominal_hours = COALESCE(EXCLUDED.nominal_hours, competencies.nominal_hours),
       ksa = COALESCE(EXCLUDED.ksa, competencies.ksa), year = COALESCE(EXCLUDED.year, competencies.year),
       target_level = COALESCE(EXCLUDED.target_level, competencies.target_level), core_attitude = COALESCE(EXCLUDED.core_attitude, competencies.core_attitude),
       description = COALESCE(EXCLUDED.description, competencies.description), description_ar = COALESCE(EXCLUDED.description_ar, competencies.description_ar)
     RETURNING (xmax = 0) AS inserted`,
    [frameworkId, parentId, c.code.toUpperCase(), c.title, c.titleAr ?? null, c.kind, c.safetyCritical, c.hours ?? null,
      c.ksa ?? null, c.year ?? null, c.targetLevel ?? null, c.coreAttitude ?? null, c.description ?? null, c.descriptionAr ?? null]);
  return rows[0]!.inserted ? 'created' : 'updated';
}

const ProgramRow = z.object({
  programCode: code(24), programName: str(120), programNameAr: str(120),
  competencyCode: z.preprocess(blank, code(60).optional()), level: z.preprocess(blank, z.string().optional()),
  parentCode: z.unknown().optional(), title: z.unknown().optional(), titleAr: z.unknown().optional(),
  safetyCritical: z.unknown().optional(), hours: z.unknown().optional(),
  ksa: z.unknown().optional(), year: z.unknown().optional(), targetLevel: z.unknown().optional(), coreAttitude: z.unknown().optional(),
  description: z.unknown().optional(), descriptionAr: z.unknown().optional(),
});

const MachineRow = z.object({
  centerCode: code(40), centerName: str(160), centerNameAr: str(160), region: str(80),
  workshop: req(120), workshopAr: str(120),
  machineType: req(80), name: str(160), brand: req(80), model: req(80), serial: req(80),
  assetTag: z.preprocess(blank, code(40).optional()), year: num(1900, 2100), status: str(40),
  competencyCode: z.preprocess(blank, code(60).optional()), photoMediaId: z.preprocess(blank, z.string().uuid().optional()), notes: str(500),
});
type MachineIn = z.infer<typeof MachineRow>;

const STATUS: Record<string, string> = {
  'in service': 'available', available: 'available', working: 'available', ok: 'available', 'يعمل': 'available', 'في الخدمة': 'available',
  maintenance: 'maintenance', 'under maintenance': 'maintenance', 'صيانة': 'maintenance', 'في الصيانة': 'maintenance',
  'locked out': 'locked_out', locked_out: 'locked_out', faulty: 'locked_out', 'معطلة': 'locked_out', 'عطلانة': 'locked_out',
  'out of service': 'retired', retired: 'retired', 'خارج الخدمة': 'retired',
};

const newQr = () => 'VTC-' + randomBytes(8).toString('hex').toUpperCase().slice(0, 10);

interface TypeRow { id: string; trade_id: string | null; name: string; name_ar: string | null; model_id: string | null; twin_match: string | null; precheck_code: string | null }

export function adminRouter(deps: { db: Db }) {
  const router = Router();
  const guard = (req: Request) => { const p = req.principal!; if (!isAdmin(p)) throw forbidden('Directors and admins only'); return p; };

  router.get('/v1/admin/programs', async (req: Request, res) => {
    guard(req);
    const { rows: programs } = await deps.db.query(
      `SELECT t.id, t.code, t.program_code AS "programCode", t.name, t.name_ar AS "nameAr", t.icon, t.sort_order AS "sortOrder",
              t.accent, t.profile,
              (SELECT count(*)::int FROM cohorts c WHERE c.trade_id = t.id) AS cohorts,
              (SELECT count(*)::int FROM workshops w WHERE w.trade_id = t.id) AS workshops
         FROM trades t ORDER BY t.sort_order, t.name`);
    const { rows: comps } = await deps.db.query<{ trade_id: string } & Record<string, unknown>>(
      `SELECT f.trade_id, f.code AS framework, c.code, c.kind, p.code AS "parentCode", c.title, c.title_ar AS "titleAr",
              c.is_safety_critical AS "safetyCritical", c.nominal_hours::float AS hours, c.ksa, c.year, c.target_level AS "targetLevel",
              c.core_attitude AS "coreAttitude", c.description, c.description_ar AS "descriptionAr"
         FROM competencies c JOIN competency_frameworks f ON f.id = c.framework_id LEFT JOIN competencies p ON p.id = c.parent_id
        WHERE f.trade_id IS NOT NULL ORDER BY f.effective_from DESC, f.code, c.year NULLS LAST, c.sort_order NULLS LAST, c.code`);
    const { rows: attitudes } = await deps.db.query(
      `SELECT code, name, name_ar AS "nameAr", indicators, indicators_ar AS "indicatorsAr" FROM core_attitudes ORDER BY code`);
    res.json({
      attitudes,
      programs: programs.map((t) => ({ ...t, competencies: comps.filter((c) => c.trade_id === t['id']).map(({ trade_id: _, ...c }) => c) })),
    });
  });

  const Program = z.object({ code: code(24), name: req(120), nameAr: str(120) });
  router.put('/v1/admin/programs/:id', async (req: Request, res) => {
    guard(req);
    const body = Program.parse(req.body);
    if (programId(body.code) !== req.params['id'] && !(await deps.db.query(`SELECT 1 FROM trades WHERE id = $1`, [req.params['id']])).rows[0]) {
      throw new HttpError(400, 'id_mismatch', 'The programme id must come from its code');
    }
    const out = await withTx(deps.db, async (tx) => {
      const r = await upsertProgram(tx, body.code, body.name, body.nameAr);
      await frameworkOf(tx, r.trade);
      return r;
    });
    res.status(out.created ? 201 : 200).json({ program: out.trade, created: out.created });
  });

  router.post('/v1/admin/programs/:id/competencies', async (req: Request, res) => {
    guard(req);
    const c = Competency.parse(req.body);
    const status = await withTx(deps.db, async (tx) => {
      const t = await tx.query<TradeRow>(`SELECT id, code, name, name_ar FROM trades WHERE id = $1`, [req.params['id']]);
      if (!t.rows[0]) throw notFound('Programme');
      return upsertCompetency(tx, await frameworkOf(tx, t.rows[0]), c);
    });
    res.status(status === 'created' ? 201 : 200).json({ status });
  });

  const Import = z.object({ rows: z.array(z.record(z.unknown())).min(1).max(5000), dryRun: z.boolean().default(false) });
  const issue = (e: ZodError) => { const i = e.issues[0]!; return `${i.path.map((p) => (p === 'kind' ? 'level' : p)).join('.') || 'row'}: ${i.message}`; };

  /** Applies rows one by one inside a transaction, each behind a savepoint; a dry run rolls everything back. */
  async function importRows<T>(rows: unknown[], dryRun: boolean, apply: (tx: Tx, row: T, i: number) => Promise<Record<string, unknown>>, schema: z.ZodType<T, z.ZodTypeDef, unknown>) {
    const results: Record<string, unknown>[] = [];
    const client = await deps.db.connect();
    try {
      await client.query('BEGIN');
      for (const [i, raw] of rows.entries()) {
        const parsed = schema.safeParse(raw);
        if (!parsed.success) { results.push({ row: i + 1, status: 'error', message: issue(parsed.error) }); continue; }
        await client.query('SAVEPOINT r');
        try {
          results.push({ row: i + 1, ...(await apply(client, parsed.data, i)) });
          await client.query('RELEASE SAVEPOINT r');
        } catch (err) {
          await client.query('ROLLBACK TO SAVEPOINT r');
          if (err instanceof ZodError) results.push({ row: i + 1, status: 'error', message: issue(err) });
          else if (err instanceof HttpError) results.push({ row: i + 1, status: 'error', message: err.message });
          else if ((err as { code?: string }).code?.startsWith('23')) results.push({ row: i + 1, status: 'error', message: (err as Error).message });
          else throw err;
        }
      }
      await client.query(dryRun ? 'ROLLBACK' : 'COMMIT');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
    const count = (s: string) => results.filter((r) => r['status'] === s).length;
    return { dryRun, created: count('created'), updated: count('updated'), errors: count('error'), results };
  }

  router.post('/v1/admin/programs/import', async (req: Request, res) => {
    guard(req);
    const { rows, dryRun } = Import.parse(req.body);
    res.json(await importRows(rows, dryRun, async (tx, r) => {
      const { trade, created } = await upsertProgram(tx, r.programCode, r.programName, r.programNameAr);
      const fw = await frameworkOf(tx, trade);
      if (!r.competencyCode) return { status: created ? 'created' : 'updated', program: trade.code };
      const c = Competency.parse({ code: r.competencyCode, kind: r.level ?? (r.parentCode ? undefined : 'unit'), parentCode: r.parentCode,
        title: r.title, titleAr: r.titleAr, safetyCritical: r.safetyCritical ?? false, hours: r.hours,
        ksa: r.ksa, year: r.year, targetLevel: r.targetLevel, coreAttitude: r.coreAttitude, description: r.description, descriptionAr: r.descriptionAr });
      return { status: await upsertCompetency(tx, fw, c), program: trade.code, code: c.code.toUpperCase() };
    }, ProgramRow));
  });

  router.get('/v1/admin/machine-types', async (req: Request, res) => {
    guard(req);
    const { rows } = await deps.db.query(
      `SELECT id, trade_id AS "tradeId", name, name_ar AS "nameAr", model_id AS "modelId", twin_match AS "twinMatch", precheck_code AS "precheckCode"
         FROM machine_types ORDER BY sort_order, name`);
    res.json({ types: rows });
  });

  router.get('/v1/admin/centers', async (req: Request, res) => {
    const p = guard(req);
    const { rows } = await deps.db.query(
      `SELECT c.id, c.code, c.name, c.name_ar AS "nameAr", c.region,
              COALESCE(json_agg(json_build_object('id', w.id, 'name', w.name, 'nameAr', w.name_ar, 'tradeId', w.trade_id,
                'machines', (SELECT count(*) FROM workshop_assets a WHERE a.workshop_id = w.id AND a.category = 'machine'))
                ORDER BY w.name) FILTER (WHERE w.id IS NOT NULL), '[]') AS workshops
         FROM centers c LEFT JOIN workshops w ON w.center_id = c.id
        WHERE c.institution_id = $1 GROUP BY c.id ORDER BY c.code`, [p.institutionId]);
    res.json({ centers: rows });
  });

  router.get('/v1/admin/machines', async (req: Request, res) => {
    const p = guard(req);
    const { rows } = await deps.db.query(
      `SELECT a.asset_tag AS tag, a.name, a.status::text, a.qr_code AS "qrCode", a.brand, a.model_no AS model, a.serial_no AS serial,
              a.year_made AS year, a.photo_media_id AS "photoId", a.imported_at AS "importedAt",
              c.code AS "centerCode", c.name AS center, c.name_ar AS "centerAr", w.name AS workshop, w.name_ar AS "workshopAr", w.trade_id AS "tradeId",
              mt.id AS "typeId", mt.name AS "typeName", mt.name_ar AS "typeNameAr", mt.model_id AS "twinId", mt.twin_match AS "twinMatch",
              pc.code AS "precheckCode", comp.code AS "competencyCode"
         FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id JOIN centers c ON c.id = w.center_id
         LEFT JOIN machine_types mt ON mt.id = a.machine_type_id
         LEFT JOIN safety_prechecks pc ON pc.id = a.precheck_id LEFT JOIN competencies comp ON comp.id = a.required_competency_id
        WHERE w.institution_id = $1 AND a.category = 'machine' ORDER BY c.code, w.name, a.asset_tag`, [p.institutionId]);
    res.json({ machines: rows });
  });

  router.post('/v1/admin/machines/import', async (req: Request, res) => {
    const p = guard(req);
    const { rows, dryRun } = Import.parse(req.body);
    const types = (await deps.db.query<TypeRow>(`SELECT id, trade_id, name, name_ar, model_id, twin_match, precheck_code FROM machine_types`)).rows;
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ');
    const typeOf = (s: string) => types.find((t) => [t.id, t.name, t.name_ar ?? ''].some((x) => norm(x) === norm(s)) || norm(`${t.name} / ${t.name_ar}`) === norm(s));
    res.json(await importRows<MachineIn>(rows, dryRun, async (tx, r) => {
      const type = typeOf(r.machineType);
      if (!type) throw new HttpError(400, 'unknown_type', `Unknown machine type "${r.machineType}". Pick one from the list, or "Other machine".`);
      const status = r.status ? STATUS[norm(r.status)] : 'available';
      if (!status) throw new HttpError(400, 'bad_status', `Status "${r.status}" is not one of: In service, Maintenance, Out of service`);

      const center = (await tx.query<{ id: string; code: string }>(
        `INSERT INTO centers (institution_id, code, name, name_ar, region) VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (institution_id, code) DO UPDATE SET name = COALESCE($6, centers.name), name_ar = COALESCE($4, centers.name_ar), region = COALESCE($5, centers.region)
         RETURNING id, code`,
        [p.institutionId, r.centerCode.toUpperCase(), r.centerName ?? r.centerCode, r.centerNameAr ?? null, r.region ?? null, r.centerName ?? null])).rows[0]!;
      let ws = (await tx.query<{ id: string; trade_id: string | null }>(
        `SELECT id, trade_id FROM workshops WHERE center_id = $1 AND (lower(name) = lower($2) OR lower(name_ar) = lower($2)) LIMIT 1`, [center.id, r.workshop])).rows[0];
      if (!ws) {
        ws = (await tx.query<{ id: string; trade_id: string | null }>(
          `INSERT INTO workshops (institution_id, center_id, name, name_ar, capacity, trade_id) VALUES ($1, $2, $3, $4, 12, $5) RETURNING id, trade_id`,
          [p.institutionId, center.id, r.workshop, r.workshopAr ?? null, type.trade_id])).rows[0]!;
      } else if (!ws.trade_id && type.trade_id) {
        await tx.query(`UPDATE workshops SET trade_id = $2 WHERE id = $1`, [ws.id, type.trade_id]);
      }

      const tradeId = type.trade_id ?? ws.trade_id;
      const precheck = (await tx.query<{ id: string }>(
        `SELECT id FROM safety_prechecks WHERE institution_id = $1 AND (code = $2 OR ($2 IS NULL AND trade_id = $3)) ORDER BY (code = $2) DESC NULLS LAST, code LIMIT 1`,
        [p.institutionId, type.precheck_code, tradeId])).rows[0]
        ?? (await tx.query<{ id: string }>(`SELECT id FROM safety_prechecks WHERE institution_id = $1 AND trade_id = $2 ORDER BY code LIMIT 1`, [p.institutionId, tradeId])).rows[0];
      let competencyId: string | null = null;
      if (r.competencyCode) {
        const c = await tx.query<{ id: string }>(`SELECT id FROM competencies WHERE upper(code) = upper($1) ORDER BY kind = 'unit' DESC LIMIT 1`, [r.competencyCode]);
        if (!c.rows[0]) throw new HttpError(400, 'unknown_competency', `No skill has the code ${r.competencyCode}; add it under Programmes first`);
        competencyId = c.rows[0].id;
      }

      // The same machine is found again by its asset tag, else by its serial number in this institution.
      const existing = (await tx.query<{ id: string; asset_tag: string; qr_code: string | null; workshop_id: string }>(
        `SELECT a.id, a.asset_tag, a.qr_code, a.workshop_id FROM workshop_assets a JOIN workshops w ON w.id = a.workshop_id
          WHERE w.institution_id = $1 AND a.category = 'machine'
            AND (($2::text IS NOT NULL AND upper(a.asset_tag) = upper($2)) OR ($2::text IS NULL AND lower(a.serial_no) = lower($3)))
          ORDER BY a.created_at LIMIT 1`, [p.institutionId, r.assetTag ?? null, r.serial])).rows[0];
      const name = r.name ?? `${type.name} · ${r.brand} ${r.model}`.slice(0, 160);
      const fields = [type.id, r.brand, r.model, r.serial, r.year ?? null, r.photoMediaId ?? null, r.notes ?? null, status, `${r.brand} ${r.model}`, precheck?.id ?? null, competencyId, name, ws.id];
      if (existing) {
        await tx.query(
          `UPDATE workshop_assets SET machine_type_id = $2, brand = $3, model_no = $4, serial_no = $5, year_made = COALESCE($6, year_made),
                  photo_media_id = COALESCE($7, photo_media_id), notes = COALESCE($8, notes),
                  status = CASE WHEN status = 'in_use' THEN status ELSE $9::asset_status END, make_model = $10,
                  precheck_id = COALESCE(precheck_id, $11), required_competency_id = COALESCE($12, required_competency_id),
                  name = $13, workshop_id = $14, qr_code = COALESCE(qr_code, $15), imported_at = now()
            WHERE id = $1`, [existing.id, ...fields, newQr()]);
        const q = await tx.query<{ qr_code: string }>(`SELECT qr_code FROM workshop_assets WHERE id = $1`, [existing.id]);
        return { status: 'updated', tag: existing.asset_tag, qrCode: q.rows[0]!.qr_code, twin: type.model_id, twinMatch: type.twin_match };
      }
      let tag = r.assetTag?.toUpperCase();
      if (!tag) {
        const stem = `${center.code}-${type.id.replace(/_/g, '').toUpperCase().slice(0, 6)}`;
        const n = await tx.query<{ n: number }>(`SELECT count(*)::int AS n FROM workshop_assets WHERE asset_tag LIKE $1 || '-%'`, [stem]);
        for (let k = n.rows[0]!.n + 1; ; k++) {
          tag = `${stem}-${String(k).padStart(2, '0')}`;
          if (!(await tx.query(`SELECT 1 FROM workshop_assets WHERE asset_tag = $1`, [tag])).rows[0]) break;
        }
      }
      const qr = newQr();
      await tx.query(
        `INSERT INTO workshop_assets (machine_type_id, brand, model_no, serial_no, year_made, photo_media_id, notes, status, make_model,
                                      precheck_id, required_competency_id, name, workshop_id, asset_tag, qr_code, category, imported_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::asset_status, $9, $10, $11, $12, $13, $14, $15, 'machine', now())`, [...fields, tag, qr])
        .catch((e: { code?: string; constraint?: string }) => {
          if (e.code === '23505') throw new HttpError(409, 'duplicate', `Asset tag ${tag} is already used by another machine`);
          throw e;
        });
      return { status: 'created', tag, qrCode: qr, twin: type.model_id, twinMatch: type.twin_match };
    }, MachineRow));
  });

  return router;
}
