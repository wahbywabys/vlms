'use server';
import { redirect } from 'next/navigation';
import { homeFor, startSession, verifyCredentials } from '@/lib/auth';

export async function login(_prev: { error?: string } | null, form: FormData): Promise<{ error?: string }> {
  const email = String(form.get('email') ?? '');
  const password = String(form.get('password') ?? '');
  if (!email || !password) return { error: 'missing' };
  const s = await verifyCredentials(email, password);
  if (!s) return { error: 'invalid' };
  await startSession(s);
  redirect(homeFor(s));
}
