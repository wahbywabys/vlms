import type { MetadataRoute } from 'next';

/** Installable on the workshop tablet and apprentice phones; opens straight into the signed-in workspace. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'VTC_LMS · WABYS', short_name: 'VTC_LMS', start_url: '/', scope: '/', display: 'standalone', orientation: 'any',
    background_color: '#f2f4f8', theme_color: '#14234c', lang: 'en', dir: 'auto',
    icons: [{ src: '/vtc-lms-mark.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
    shortcuts: [
      { name: 'Workshop floor', url: '/trainer' }, { name: 'Machine access', url: '/student/machine' }, { name: 'Logbook check-in', url: '/student/logbook' },
    ],
  };
}
