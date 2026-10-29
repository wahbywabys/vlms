import { redirect } from 'next/navigation';
import { LangToggle } from '@/components/LangToggle';
import { LogoMark, Wordmark } from '@/components/Logo';
import { getSession, homeFor } from '@/lib/auth';
import { getI18n } from '@/lib/i18n-server';
import { LoginForm } from './LoginForm';

export const metadata = { title: 'Sign in' };

export default async function LoginPage() {
  const s = await getSession();
  if (s) redirect(homeFor(s));
  const { L } = await getI18n();
  return (
    <div className="login">
      <div className="login-top"><LangToggle /></div>
      <div className="login-hero">
        <LogoMark size={88} />
        <Wordmark />
        <p className="login-tag">{L('Vocational Training Centre learning management system', 'نظام إدارة التعلم لمراكز التدريب المهني')}</p>
        <p className="muted">{L('Competencies, virtual labs, the workshop floor and work-based learning in one record.',
          'الجدارات والمعامل الافتراضية وأرضية الورشة والتعلم في موقع العمل في سجل واحد.')}</p>
      </div>
      <LoginForm />
    </div>
  );
}
