'use client';
/** App chrome: VTC_LMS brand, the workspace's sections, alerts, language, full screen and the signed-in user. */
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Txt } from '@/lib/i18n';
import { FullscreenIcon, useFullscreen } from './fullscreen';
import { LangToggle } from './LangToggle';
import { useL } from './LangProvider';
import { LogoMark, Wordmark } from './Logo';

export interface Section { href: string; label: Txt; exact?: boolean }
export interface ShellUser { name: string; nameAr: string | null; roleKey: string; roleLabel: Txt; initials: Txt }
export interface WorkspaceLink { href: string; label: Txt; active: boolean }

export function Shell({ user, sections, workspaces, institution, alertsHref, children }: {
  user: ShellUser; sections: Section[]; workspaces: WorkspaceLink[]; institution: Txt; alertsHref?: string; children: ReactNode;
}) {
  const { L, pick, ar } = useL();
  const path = usePathname();
  const appRef = useRef<HTMLDivElement>(null);
  const fs = useFullscreen(appRef);
  const openAlerts = useOpenAlerts(Boolean(alertsHref));
  const [menu, setMenu] = useState(false);
  const isActive = (s: Section) => (s.exact ? path === s.href : path === s.href || path.startsWith(`${s.href}/`));

  return (
    <div ref={appRef} className={`app ${fs.isFull ? 'is-full' : ''} ${fs.isFallback ? 'is-max' : ''}`}>
      <header className="topbar">
        <div className="topbar-inner">
          <Link href={workspaces.find((w) => w.active)?.href ?? '/'} className="brand" aria-label="VTC_LMS">
            <LogoMark />
            <div className="brand-text">
              <Wordmark />
              <span className="brand-sub">{pick(institution)}</span>
            </div>
          </Link>

          <nav className="roles nav" aria-label={L('Sections', 'الأقسام')}>
            {sections.map((s) => (
              <Link key={s.href} href={s.href} aria-current={isActive(s) ? 'page' : undefined}>
                <span className="role-label">{pick(s.label)}</span>
                {alertsHref === s.href && openAlerts > 0 && (
                  <span className="badge" aria-label={L(`${openAlerts} open alerts`, `${openAlerts} تنبيهات مفتوحة`)}>{openAlerts}</span>
                )}
              </Link>
            ))}
          </nav>

          <div className="tools">
            <LangToggle />
            <button type="button" className="fs-btn" aria-pressed={fs.isFull} onClick={() => void fs.toggle()}
              title={fs.isFull ? L('Exit full screen (Esc)', 'الخروج من ملء الشاشة (Esc)') : L('Full screen', 'ملء الشاشة')}>
              <FullscreenIcon exit={fs.isFull} />
              <span className="fs-text">{fs.isFull ? L('Exit full screen', 'خروج من ملء الشاشة') : L('Full screen', 'ملء الشاشة')}</span>
            </button>
            <div className="user">
              <button type="button" className="user-btn" aria-expanded={menu} aria-haspopup="menu" onClick={() => setMenu((m) => !m)}>
                <span className={`avatar av-${user.roleKey}`} aria-hidden="true">{pick(user.initials)}</span>
                <span className="role-text">
                  <span className="role-label">{ar(user.name, user.nameAr)}</span>
                  <span className="role-who">{pick(user.roleLabel)}</span>
                </span>
              </button>
              {menu && (
                <div className="user-menu" role="menu" onKeyDown={(e) => e.key === 'Escape' && setMenu(false)}>
                  {workspaces.length > 1 && <p className="eyebrow">{L('Workspaces', 'مساحات العمل')}</p>}
                  {workspaces.length > 1 && workspaces.map((w) => (
                    <Link key={w.href} href={w.href} role="menuitem" aria-current={w.active ? 'page' : undefined} onClick={() => setMenu(false)}>{pick(w.label)}</Link>
                  ))}
                  <form action="/logout" method="post"><button type="submit" role="menuitem">{L('Sign out', 'تسجيل الخروج')}</button></form>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>
      <main className="screen">{children}</main>
      <footer className="app-foot">
        <span>VTC_LMS</span>
        <span className="muted">{L('Demo build · every name and number is illustrative', 'نسخة تجريبية · كل الأسماء والأرقام توضيحية')}</span>
      </footer>
    </div>
  );
}

/** Polls the alert rail so the badge stays current on every staff page. */
function useOpenAlerts(enabled: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let stop = false;
    const tick = async () => {
      const r = await fetch('/api/v1/alerts?status=open', { cache: 'no-store' }).catch(() => null);
      if (r?.ok && !stop) setN(((await r.json()) as { alerts: unknown[] }).alerts.length);
    };
    void tick();
    const t = setInterval(tick, 8000);
    return () => { stop = true; clearInterval(t); };
  }, [enabled]);
  return n;
}
