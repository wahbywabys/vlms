import type { HelpArt as Art } from '@/lib/help';

/** Simple drawn pictures for the Instructions steps that happen outside the app (Wi-Fi, camera, home screen…). */
export function HelpArt({ art }: { art: Art }) {
  const phone = (inner: React.ReactNode) => (
    <svg viewBox="0 0 160 120" width="200" height="150" role="img" aria-hidden="true" className="help-art">
      <rect x="52" y="6" width="56" height="108" rx="10" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="3" />
      <rect x="72" y="11" width="16" height="3" rx="1.5" fill="var(--ink-3)" />
      {inner}
    </svg>
  );
  switch (art) {
    case 'wifi':
      return phone(<g fill="none" stroke="var(--blue)" strokeWidth="5" strokeLinecap="round">
        <path d="M62 50a26 26 0 0 1 36 0" /><path d="M68 60a16 16 0 0 1 24 0" /><circle cx="80" cy="70" r="3" fill="var(--blue)" />
        <text x="80" y="96" textAnchor="middle" fontSize="9" fill="var(--ink-2)" stroke="none" fontWeight="600">VTC-WiFi</text></g>);
    case 'scan':
      return (
        <svg viewBox="0 0 160 120" width="200" height="150" role="img" aria-hidden="true" className="help-art">
          <rect x="8" y="22" width="56" height="56" fill="#fff" stroke="var(--ink)" strokeWidth="2" />
          {[[12, 26], [44, 26], [12, 58]].map(([x, y]) => <g key={`${x}${y}`}><rect x={x} y={y} width="16" height="16" fill="var(--ink)" /><rect x={x! + 4} y={y! + 4} width="8" height="8" fill="#fff" /></g>)}
          <rect x="34" y="34" width="6" height="6" fill="var(--ink)" /><rect x="46" y="50" width="8" height="6" fill="var(--ink)" /><rect x="34" y="62" width="6" height="10" fill="var(--ink)" />
          <rect x="92" y="6" width="56" height="108" rx="10" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="3" />
          <rect x="100" y="34" width="40" height="40" fill="none" stroke="var(--amber)" strokeWidth="3" strokeDasharray="10 6" />
          <path d="M70 50h16" stroke="var(--amber)" strokeWidth="4" strokeLinecap="round" /><path d="M80 44l6 6-6 6" fill="none" stroke="var(--amber)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="120" cy="96" r="7" fill="none" stroke="var(--ink)" strokeWidth="3" />
        </svg>
      );
    case 'home':
      return phone(<g>
        {[0, 1, 2].flatMap((r) => [0, 1].map((c) => <rect key={`${r}${c}`} x={62 + c * 20} y={24 + r * 22} width="14" height="14" rx="3" fill="var(--sunk)" stroke="var(--rule)" />))}
        <rect x="70" y="88" width="20" height="20" rx="5" fill="var(--navy, #14234c)" /><path d="M80 92l6 4v8h-12v-8z" fill="#f06721" />
        <circle cx="96" cy="88" r="7" fill="var(--ok)" /><path d="M93 88h6M96 85v6" stroke="#fff" strokeWidth="2" /></g>);
    case 'signin':
      return phone(<g><rect x="60" y="40" width="40" height="10" rx="3" fill="var(--sunk)" stroke="var(--rule)" /><rect x="60" y="56" width="40" height="10" rx="3" fill="var(--sunk)" stroke="var(--rule)" />
        <rect x="60" y="74" width="40" height="12" rx="4" fill="var(--blue)" /></g>);
    case 'sticker':
      return (
        <svg viewBox="0 0 160 120" width="200" height="150" role="img" aria-hidden="true" className="help-art">
          <rect x="14" y="30" width="110" height="70" rx="6" fill="var(--sunk)" stroke="var(--ink)" strokeWidth="3" />
          <rect x="24" y="100" width="12" height="12" fill="var(--ink)" /><rect x="102" y="100" width="12" height="12" fill="var(--ink)" />
          <circle cx="44" cy="62" r="16" fill="none" stroke="var(--ink-2)" strokeWidth="3" /><circle cx="44" cy="62" r="4" fill="var(--ink-2)" />
          <rect x="76" y="44" width="38" height="40" rx="3" fill="#fff" stroke="var(--amber)" strokeWidth="3" />
          <rect x="82" y="50" width="10" height="10" fill="var(--ink)" /><rect x="98" y="50" width="10" height="10" fill="var(--ink)" /><rect x="82" y="66" width="10" height="10" fill="var(--ink)" />
          <rect x="98" y="68" width="6" height="6" fill="var(--ink)" />
          <text x="95" y="24" textAnchor="middle" fontSize="11" fill="var(--amber)" fontWeight="700">QR</text>
        </svg>
      );
    case 'server':
      return (
        <svg viewBox="0 0 160 120" width="200" height="150" role="img" aria-hidden="true" className="help-art">
          <rect x="20" y="14" width="120" height="76" rx="6" fill="var(--sheet)" stroke="var(--ink)" strokeWidth="3" />
          <rect x="56" y="30" width="48" height="44" rx="4" fill="#fff" stroke="var(--rule)" />
          <rect x="68" y="38" width="24" height="24" fill="var(--ink)" /><rect x="74" y="44" width="12" height="12" fill="#fff" />
          <path d="M66 90l-8 18h44l-8-18" fill="var(--sunk)" stroke="var(--ink)" strokeWidth="3" />
          <circle cx="130" cy="82" r="3" fill="var(--ok)" />
        </svg>
      );
    case 'offline':
      return (
        <svg viewBox="0 0 160 120" width="200" height="150" role="img" aria-hidden="true" className="help-art">
          <path d="M44 84a20 20 0 0 1 4-40 28 28 0 0 1 54-4 22 22 0 0 1 14 44z" fill="var(--sunk)" stroke="var(--ink-2)" strokeWidth="3" />
          <path d="M80 54v26M70 70l10 10 10-10" fill="none" stroke="var(--blue)" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="124" cy="94" r="14" fill="var(--ok)" /><path d="M117 94l5 5 9-10" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" />
        </svg>
      );
    case 'lang':
      return (
        <svg viewBox="0 0 160 120" width="200" height="150" role="img" aria-hidden="true" className="help-art">
          <rect x="20" y="40" width="120" height="40" rx="12" fill="var(--sheet)" stroke="var(--rule)" strokeWidth="2" />
          <rect x="22" y="42" width="58" height="36" rx="10" fill="var(--navy, #14234c)" />
          <text x="51" y="66" textAnchor="middle" fontSize="16" fill="#fff" fontWeight="700">EN</text>
          <text x="110" y="66" textAnchor="middle" fontSize="16" fill="var(--ink)" fontWeight="700">عربي</text>
        </svg>
      );
  }
}
