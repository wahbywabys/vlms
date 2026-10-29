'use client';
import { useActionState } from 'react';
import { useL } from '@/components/LangProvider';
import { login } from './actions';

export const DEMO_ACCOUNTS = [
  { email: 'student@vtc.example', role: { en: 'Student · CNC machining', ar: 'الطالب · تشغيل CNC' }, who: { en: 'Omar Lotfy', ar: 'عمر لطفي' }, key: 'student', initials: { en: 'OL', ar: 'ع' } },
  { email: 'student.auto@vtc.example', role: { en: 'Student · Automotive', ar: 'الطالب · ميكانيكا السيارات' }, who: { en: 'Ziad Hassan', ar: 'زياد حسن' }, key: 'student', initials: { en: 'ZH', ar: 'ز' } },
  { email: 'student.elec@vtc.example', role: { en: 'Student · Electrical', ar: 'الطالب · التركيبات الكهربائية' }, who: { en: 'Rana Ibrahim', ar: 'رنا إبراهيم' }, key: 'student', initials: { en: 'RI', ar: 'ر' } },
  { email: 'student.weld@vtc.example', role: { en: 'Student · Welding', ar: 'الطالب · اللحام' }, who: { en: 'Hassan Gamal', ar: 'حسن جمال' }, key: 'student', initials: { en: 'HG', ar: 'ح' } },
  { email: 'trainer@vtc.example', role: { en: 'Vocational trainer', ar: 'المدرب المهني' }, who: { en: 'Eng. Huda Kamal', ar: 'م. هدى كمال' }, key: 'trainer', initials: { en: 'HK', ar: 'ه' } },
  { email: 'teacher@vtc.example', role: { en: 'Academic teacher', ar: 'المعلم الأكاديمي' }, who: { en: 'Mr. Ahmed Saleh', ar: 'أ. أحمد صالح' }, key: 'teacher', initials: { en: 'AS', ar: 'أ' } },
  { email: 'supervisor@vtc.example', role: { en: 'Workplace supervisor', ar: 'مشرف موقع العمل' }, who: { en: 'Eng. Tamer Hassan', ar: 'م. تامر حسن' }, key: 'supervisor', initials: { en: 'TH', ar: 'ت' } },
  { email: 'director@vtc.example', role: { en: 'Director', ar: 'المدير' }, who: { en: 'Dr. Samia Rashad', ar: 'د. سامية رشاد' }, key: 'director', initials: { en: 'SR', ar: 'س' } },
];

export function LoginForm() {
  const { L, pick } = useL();
  const [state, action, pending] = useActionState(login, null);
  return (
    <div className="login-forms">
      <form action={action} className="login-card panel">
        <h2>{L('Sign in', 'تسجيل الدخول')}</h2>
        <label className="field"><span>{L('Email', 'البريد الإلكتروني')}</span>
          <input name="email" type="email" autoComplete="username" required dir="ltr" /></label>
        <label className="field"><span>{L('Password', 'كلمة المرور')}</span>
          <input name="password" type="password" autoComplete="current-password" required dir="ltr" /></label>
        {state?.error && (
          <p className="notice notice-danger" role="alert">
            {state.error === 'invalid' ? L('That email and password do not match an account.', 'البريد الإلكتروني وكلمة المرور لا يطابقان أي حساب.')
              : L('Enter your email and password.', 'أدخل البريد الإلكتروني وكلمة المرور.')}
          </p>
        )}
        <button type="submit" className="primary" disabled={pending}>{pending ? L('Signing in…', 'جارٍ الدخول…') : L('Sign in', 'دخول')}</button>
      </form>

      <section className="panel demo-accounts" aria-labelledby="demo-h">
        <h2 id="demo-h">{L('Demo accounts', 'حسابات تجريبية')}</h2>
        <p className="muted small">{L('One account per role, and a learner in each trade. Password for all:', 'حساب لكل دور، ومتدرب في كل تخصص. كلمة المرور للجميع:')} <code dir="ltr">demo1234</code></p>
        <ul>
          {DEMO_ACCOUNTS.map((a) => (
            <li key={a.email}>
              <form action={action}>
                <input type="hidden" name="email" value={a.email} />
                <input type="hidden" name="password" value="demo1234" />
                <button type="submit" disabled={pending}>
                  <span className={`avatar av-${a.key}`} aria-hidden="true">{pick(a.initials)}</span>
                  <span className="role-text">
                    <span className="role-label">{pick(a.role)}</span>
                    <span className="role-who">{pick(a.who)} · <span dir="ltr">{a.email}</span></span>
                  </span>
                </button>
              </form>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
