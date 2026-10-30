import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { LangProvider } from '@/components/LangProvider';
import { PwaRegister } from '@/components/PwaRegister';
import { getLang } from '@/lib/i18n-server';
import './fonts.css';
import './vtc.css';
import './app.css';
import './tw.css';

export const metadata: Metadata = {
  title: { default: 'VTC_LMS', template: '%s · VTC_LMS' },
  description: 'Vocational Training Centre learning management system: competencies, V-Labs, workshop floor, work-based learning.',
  icons: { icon: '/vtc-lms-mark.svg' },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, viewportFit: 'cover', themeColor: '#14234c' };

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lang = await getLang();
  return (
    <html lang={lang} dir={lang === 'ar' ? 'rtl' : 'ltr'}>
      <body>
        <LangProvider lang={lang}>{children}</LangProvider>
        <PwaRegister />
      </body>
    </html>
  );
}
