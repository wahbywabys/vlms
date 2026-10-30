import Link from 'next/link';
import { HelpArt } from '@/components/HelpArt';
import { LangToggle } from '@/components/LangToggle';
import { LogoMark, Wordmark } from '@/components/Logo';
import { getSession, homeFor } from '@/lib/auth';
import { AUDIENCE_FOR_WORKSPACE, AUDIENCES, GUIDES, type HelpAudience } from '@/lib/help';
import { getI18n } from '@/lib/i18n-server';
import { PrintButton } from '../join/PrintButton';

/**
 * تعليمات / Instructions: step-by-step guides with pictures, opened from the
 * Instructions button on every screen (and on the sign-in and join pages).
 * Public, so a person who cannot sign in yet can still read how to.
 * ?for=<audience> picks the tab; otherwise the signed-in role's tab.
 */
export const metadata = { title: 'Instructions · تعليمات' };

export default async function HelpPage({ searchParams }: { searchParams: Promise<{ for?: string; open?: string }> }) {
  const { L, pick, lang } = await getI18n();
  const sp = await searchParams;
  const s = await getSession();
  const fromRole = s ? AUDIENCE_FOR_WORKSPACE[homeFor(s).slice(1)] ?? null : null;
  const who: HelpAudience = AUDIENCES.some((a) => a.key === sp.for) ? sp.for as HelpAudience : fromRole ?? 'everyone';
  const guides = GUIDES.filter((g) => g.audience === who);
  const back = s ? homeFor(s) : '/login';

  return (
    <div className="help">
      <div className="help-top no-print">
        <Link className="button" href={back}>{L('← Back', 'رجوع →')}</Link>
        <LangToggle />
      </div>
      <header className="help-head">
        <LogoMark size={48} />
        <Wordmark />
        <h1>{L('Instructions', 'تعليمات')}</h1>
        <p className="muted">{L('1. Choose who you are.  2. Tap the task you need.  3. Follow the steps and pictures.',
          '١. اختار إنت مين.  ٢. اضغط على المهمة اللي محتاجها.  ٣. امشي ورا الخطوات والصور.')}</p>
      </header>

      <nav className="help-tabs no-print" aria-label={L('Who are you?', 'إنت مين؟')}>
        {AUDIENCES.map((a) => (
          <Link key={a.key} href={`/help?for=${a.key}`} aria-current={a.key === who ? 'page' : undefined}>
            <span aria-hidden="true">{a.icon}</span> {pick(a.label)}
          </Link>
        ))}
      </nav>

      {who !== 'everyone' && (
        <p className="help-new no-print">
          {L('New to VTC_LMS? First read ', 'أول مرة تستخدم VTC_LMS؟ اقرا الأول ')}
          <Link href="/help?for=everyone">{L('“Start here”', '"ابدأ من هنا"')}</Link>.
        </p>
      )}

      <div className="help-list">
        {guides.map((g, i) => (
          <details key={g.id} id={g.id} className="help-guide" open={sp.open ? sp.open === g.id : i === 0}>
            <summary>
              <span className="help-n" aria-hidden="true">{i + 1}</span>
              <span className="help-title">{pick(g.title)}</span>
              <span className="help-chev" aria-hidden="true">▾</span>
            </summary>
            {g.intro && <p className="help-intro">{pick(g.intro)}</p>}
            <ol className="help-steps">
              {g.steps.map((st, k) => (
                <li key={k}>
                  <span className="help-step-n" aria-hidden="true">{k + 1}</span>
                  <div className="help-step-body">
                    <p>{pick(st.t)}</p>
                    {(st.img || st.ill) && (
                      <div className="help-pics">
                        {st.ill && <HelpArt art={st.ill} />}
                        {st.img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/help/${lang}/${st.img}.webp`} alt="" loading="lazy" className="help-shot" width={270} height={540} />
                        )}
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ol>
            {g.tip && <p className="help-tip"><span aria-hidden="true">💡</span> {pick(g.tip)}</p>}
          </details>
        ))}
      </div>

      <p className="help-foot no-print">
        <PrintButton label={L('Print these instructions', 'اطبع التعليمات دي')} />
        <span className="muted">{L('Still stuck? Ask your trainer.', 'لسه مش عارف؟ اسأل المدرب.')}</span>
      </p>
    </div>
  );
}
