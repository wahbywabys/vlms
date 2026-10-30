/**
 * Add or update a sign-in account from the command line (a centre installed
 * without the demo data starts with none):
 *
 *   npx tsx src/add-user.ts --email director@centre.org --name "Dr. Samia Rashad" --role director --password 'S3cret!pass' [--name-ar "…"] [--cohort "CNC Y2-A"]
 *
 * On a centre server: docker compose exec api npx tsx src/add-user.ts …
 * Roles: student, vocational_trainer, academic_teacher, industry_supervisor, director, qa_auditor, admin.
 * --cohort adds the account to that cohort (by name) as a member.
 */
import { parseArgs } from 'node:util';
import pg from 'pg';

const ROLES = ['student', 'vocational_trainer', 'academic_teacher', 'industry_supervisor', 'director', 'qa_auditor', 'admin'];
const { values: a } = parseArgs({ options: {
  email: { type: 'string' }, name: { type: 'string' }, 'name-ar': { type: 'string' }, role: { type: 'string', multiple: true },
  password: { type: 'string' }, cohort: { type: 'string' },
} });
if (!a.email || !a.name || !a.role?.length || !a.password) {
  console.error('Usage: add-user --email <email> --name <full name> --role <role> [--role <role>] --password <password> [--name-ar <name>] [--cohort <cohort name>]');
  process.exit(2);
}
const bad = a.role.filter((r) => !ROLES.includes(r));
if (bad.length) { console.error(`Unknown role ${bad.join(', ')}. Use one of: ${ROLES.join(', ')}`); process.exit(2); }
if (a.password.length < 8) { console.error('Use a password of at least 8 characters.'); process.exit(2); }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, options: '-c search_path=vtc,public' });
await client.connect();
try {
  await client.query('BEGIN');
  const inst = (await client.query<{ id: string }>('SELECT id FROM institutions ORDER BY created_at LIMIT 1')).rows[0];
  if (!inst) throw new Error('No institution yet: run the migrations first');
  const { rows: [u] } = await client.query<{ id: string }>(
    `INSERT INTO users (institution_id, email, full_name, full_name_ar, password_hash) VALUES ($1, $2, $3, $4, crypt($5, gen_salt('bf')))
     ON CONFLICT (institution_id, email) DO UPDATE SET full_name = EXCLUDED.full_name, full_name_ar = coalesce(EXCLUDED.full_name_ar, users.full_name_ar),
       password_hash = EXCLUDED.password_hash, is_active = true, updated_at = now()
     RETURNING id`, [inst.id, a.email.trim(), a.name, a['name-ar'] ?? null, a.password]);
  for (const r of a.role) await client.query('INSERT INTO user_roles (user_id, role) VALUES ($1, $2) ON CONFLICT DO NOTHING', [u!.id, r]);
  if (a.cohort) {
    const c = (await client.query<{ id: string }>('SELECT id FROM cohorts WHERE institution_id = $1 AND name = $2', [inst.id, a.cohort])).rows[0];
    if (!c) throw new Error(`No cohort named "${a.cohort}"`);
    const member = a.role.includes('student') ? 'student' : a.role[0];
    await client.query('INSERT INTO cohort_members (cohort_id, user_id, member_role) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING', [c.id, u!.id, member]);
  }
  await client.query('COMMIT');
  console.log(`Account ready: ${a.email} (${a.role.join(', ')})`);
} catch (err) {
  await client.query('ROLLBACK');
  console.error((err as Error).message);
  process.exitCode = 1;
} finally {
  await client.end();
}
