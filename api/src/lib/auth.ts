import type { NextFunction, Request, Response } from 'express';
import { jwtVerify } from 'jose';
import { HttpError } from './errors.js';

export type Role =
  | 'academic_teacher'
  | 'vocational_trainer'
  | 'student'
  | 'industry_supervisor'
  | 'director'
  | 'qa_auditor'
  | 'admin';

export interface Principal {
  userId: string;
  institutionId: string;
  roles: Role[];
}

declare module 'express-serve-static-core' {
  interface Request {
    principal?: Principal;
  }
}

/**
 * Verifies the bearer JWT minted by the identity service (OIDC / LTI 1.3
 * launch). Expected claims: sub, inst, roles[].
 */
export function requireAuth(secret: string) {
  const key = new TextEncoder().encode(secret);
  return async (req: Request, _res: Response, next: NextFunction) => {
    const header = req.headers.authorization ?? '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return next(new HttpError(401, 'unauthenticated', 'Missing bearer token'));
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ['HS256'] });
      if (typeof payload.sub !== 'string' || typeof payload['inst'] !== 'string' || !Array.isArray(payload['roles'])) {
        throw new Error('missing claims');
      }
      req.principal = { userId: payload.sub, institutionId: payload['inst'], roles: payload['roles'] as Role[] };
      next();
    } catch {
      next(new HttpError(401, 'unauthenticated', 'Invalid or expired token'));
    }
  };
}

export const isStaff = (p: Principal) =>
  p.roles.some((r) => r === 'vocational_trainer' || r === 'academic_teacher' || r === 'qa_auditor' || r === 'admin');
