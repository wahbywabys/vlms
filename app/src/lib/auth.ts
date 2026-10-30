import 'server-only';
import { SignJWT, jwtVerify } from 'jose';
import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { q1 } from './db';

export type Role = 'academic_teacher' | 'vocational_trainer' | 'student' | 'industry_supervisor' | 'director' | 'qa_auditor' | 'admin';

/** The five workspaces of the app, in the order the role picker shows them. */
export const WORKSPACES = [
  { role: 'student', path: '/student' },
  { role: 'vocational_trainer', path: '/trainer' },
  { role: 'academic_teacher', path: '/teacher' },
  { role: 'industry_supervisor', path: '/supervisor' },
  { role: 'director', path: '/director' },
] as const satisfies readonly { role: Role; path: string }[];

export interface Session {
  userId: string;
  institutionId: string;
  roles: Role[];
  name: string;
  nameAr: string | null;
  email: string;
}

const COOKIE = 'vtc_session';
const MAX_AGE_S = 8 * 3600; // one training day
const key = (name: 'SESSION_SECRET' | 'JWT_SECRET') => {
  const s = process.env[name];
  if (!s || s.length < 32) throw new Error(`${name} must be set (>= 32 chars)`);
  return new TextEncoder().encode(s);
};

/** Checks email + password against the bcrypt hash in Postgres (pgcrypto crypt()). */
export async function verifyCredentials(email: string, password: string): Promise<Session | null> {
  const row = await q1<{ id: string; institution_id: string; full_name: string; full_name_ar: string | null; email: string; roles: Role[] }>(
    `SELECT u.id, u.institution_id, u.full_name, u.full_name_ar, u.email::text AS email,
            array_agg(r.role::text ORDER BY r.role) AS roles
       FROM users u JOIN user_roles r ON r.user_id = u.id
      WHERE u.email = $1 AND u.is_active AND u.password_hash IS NOT NULL
        AND u.password_hash = crypt($2, u.password_hash)
      GROUP BY u.id`,
    [email.trim(), password],
  );
  if (!row) return null;
  return { userId: row.id, institutionId: row.institution_id, roles: row.roles, name: row.full_name, nameAr: row.full_name_ar, email: row.email };
}

export async function startSession(s: Session) {
  const token = await new SignJWT({ inst: s.institutionId, roles: s.roles, name: s.name, nameAr: s.nameAr, email: s.email })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(s.userId).setIssuedAt().setExpirationTime(`${MAX_AGE_S}s`)
    .sign(key('SESSION_SECRET'));
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: 'lax', secure: await secureRequest(), path: '/', maxAge: MAX_AGE_S,
  });
}

/**
 * Secure cookies only over HTTPS. A training-centre server is often reached at
 * plain http://192.168.x.x on the local Wi-Fi, where a Secure cookie would be
 * dropped and nobody could sign in. COOKIE_SECURE=true|false overrides.
 */
async function secureRequest() {
  const forced = process.env.COOKIE_SECURE;
  if (forced === 'true' || forced === 'false') return forced === 'true';
  const proto = (await headers()).get('x-forwarded-proto')?.split(',')[0]?.trim();
  return proto ? proto === 'https' : process.env.NODE_ENV === 'production';
}

export async function endSession() {
  (await cookies()).delete(COOKIE);
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload: p } = await jwtVerify(token, key('SESSION_SECRET'), { algorithms: ['HS256'] });
    return {
      userId: p.sub!, institutionId: p['inst'] as string, roles: p['roles'] as Role[],
      name: p['name'] as string, nameAr: (p['nameAr'] as string | null) ?? null, email: p['email'] as string,
    };
  } catch {
    return null;
  }
}

/** For pages: the signed-in user, who must hold one of `roles`. */
export async function requireRole(...roles: Role[]): Promise<Session> {
  const s = await getSession();
  if (!s) redirect('/login');
  if (roles.length && !s.roles.some((r) => roles.includes(r))) redirect(homeFor(s));
  return s;
}

export function homeFor(s: Pick<Session, 'roles'>): string {
  return WORKSPACES.find((w) => s.roles.includes(w.role))?.path ?? '/login';
}

/** Short-lived bearer token for the VTC_LMS API (same claims the API verifies). */
export async function apiToken(s: Session): Promise<string> {
  return new SignJWT({ inst: s.institutionId, roles: s.roles })
    .setProtectedHeader({ alg: 'HS256' }).setSubject(s.userId).setExpirationTime('5m')
    .sign(key('JWT_SECRET'));
}
