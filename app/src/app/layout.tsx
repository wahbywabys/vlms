import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { LangProvider } from '@/components/LangProvider';
import { getLang } from '@/lib/i18n-server';
import './vtc.css';
import './app.css';

export const metadata: Metadata = {
  title: { default: 'VTC_LMS', template: '%s · VTC_LMS' },
  description: 'Vocational Training Centre learning management system: competencies, V-Labs, workshop floor, work-based learning.',
  icons: { icon: '/vtc-lms-mark.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&family=Noto+Kufi+Arabic:wght@500;600;700&display=swap" />
      </head>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
      </body>
    </html>
  );
}
