/**
 * VTC_LMS brand mark and wordmark. Standalone copies for other apps live in
 * ./assets (vtc-lms-mark.svg, vtc-lms-logo.svg, vtc-lms-logo-dark.svg); this
 * inline version takes its colours from the theme tokens so it follows dark mode.
 */
export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg className="logo-mark" viewBox="0 0 48 48" width={size} height={size} aria-hidden="true">
      {/* Hex nut (the workshop) carrying a V that closes as a tick (competency signed off), in safety amber. */}
      <path d="M24 3.5 41.8 13.75v20.5L24 44.5 6.2 34.25v-20.5Z" className="lm-nut" strokeWidth="3" strokeLinejoin="round" />
      <path d="M24 9.2 36.9 16.6v14.8L24 38.8 11.1 31.4V16.6Z" className="lm-ring" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M14.5 18.5 23 32" className="lm-v" strokeWidth="5" strokeLinecap="round" />
      <path d="M23 32 34 14.5" className="lm-tick" strokeWidth="5" strokeLinecap="round" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark" dir="ltr" aria-label="VTC_LMS">
      VTC<span className="wm-us" aria-hidden="true">_</span><span className="wm-lms">LMS</span>
    </span>
  );
}
