import 'server-only';
import pg from 'pg';

const globalForPg = globalThis as unknown as { vtcPool?: pg.Pool };

/** One pool per server process (survives dev hot reloads). */
export const db =
  globalForPg.vtcPool ??
  new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 10, options: '-c search_path=vtc,public' });
globalForPg.vtcPool = db;

export async function q<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T[]> {
  return (await db.query<T>(text, params)).rows;
}
export async function q1<T extends pg.QueryResultRow>(text: string, params: unknown[] = []): Promise<T | undefined> {
  return (await db.query<T>(text, params)).rows[0];
}
