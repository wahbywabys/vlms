import qrcode from 'qrcode-generator';
import { LangToggle } from '@/components/LangToggle';
import { LogoMark, Wordmark } from '@/components/Logo';
import { centerAddresses, hubConfig, uplinkStatus } from '@/lib/center';
import { getI18n } from '@/lib/i18n-server';
import { PrintButton } from './PrintButton';

/**
 * The centre's "join" poster: open http://<server>/join on the server or a
 * projector, or print it for the workshop wall. Devices on the centre Wi-Fi
 * scan the code to open VTC_LMS, then add it to their home screen.
 * Public: it shows only the address and whether cloud sync is working.
 */
export const metadata = { title: 'Connect a device' };
export const dynamic = 'force-dynamic';

function Qr({ text, size = 220 }: { text: string; size?: number }) {
  const q = qrcode(0, 'M');
  q.addData(text);
  q.make();
  const n = q.getModuleCount();
  let d = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c)) d += `M${c + 4} ${r + 4}h1v1h-1z`;
  return (
    <svg viewBox={`0 0 ${n + 8} ${n + 8}`} width={size} height={size} role="img" aria-label={text} shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" /><path d={d} fill="#000" />
    </svg>
  );
}

export default async function JoinPage({ searchParams }: { searchParams: Promise<{ window?: string }> }) {
  // ?window=1: the small address window "Start VTC_LMS" opens on the server laptop.
  const small = (await searchParams).window === '1';
  const { L } = await getI18n();
  const addr = await centerAddresses();
  const hub = hubConfig();
  const up = hub ? await uplinkStatus() : null;
  const main = addr.http ?? addr.https!;
  const ago = (d: Date | null) => {
    if (!d) return L('never', 'لم تتم بعد');
    const m = Math.round((Date.now() - new Date(d).getTime()) / 60_000);
    return m < 1 ? L('just now', 'الآن') : m < 60 ? L(`${m} min ago`, `منذ ${m} دقيقة`) : m < 1440
      ? L(`${Math.round(m / 60)} h ago`, `منذ ${Math.round(m / 60)} ساعة`) : L(`${Math.round(m / 1440)} days ago`, `منذ ${Math.round(m / 1440)} يوم`);
  };
  const healthy = up?.last_success_at && (!up.last_attempt_at || new Date(up.last_success_at) >= new Date(up.last_attempt_at));

  return (
    <div className={`join${small ? ' join-small' : ''}`}>
      <div className="login-top join-noprint">
        <a className="help-btn" href="/help?for=everyone"><span className="q" aria-hidden="true">?</span>{L('Instructions', 'تعليمات')}</a>
        <LangToggle />
      </div>
      <header className="join-head">
        <LogoMark size={64} />
        <Wordmark />
        {addr.name && <p className="login-tag">{addr.name}</p>}
      </header>

      <section className="card join-card">
        <h1>{small ? L('VTC_LMS is running', 'VTC_LMS شغال') : L('Connect your phone, tablet or laptop', 'وصّل موبايلك أو التابلت أو اللابتوب')}</h1>
        {small && <p className="muted">{L('On the same Wi-Fi, scan the code or type the address. Keep this computer on.', 'على نفس الواي فاي، صوّر الكود أو اكتب العنوان. خلّي الجهاز ده شغال.')}</p>}
        <div className="join-grid">
          <div className="join-qr">
            <Qr text={main} />
            <code className="join-url">{main}</code>
          </div>
          {!small && <ol className="join-steps">
            <li>
              <b>{L('Join the centre Wi-Fi', 'اتصل بشبكة الواي فاي بتاعة المركز')}</b>
              {addr.wifi && <> — <code>{addr.wifi}</code></>}
              <span className="muted">{L('No internet is needed.', 'مش محتاج إنترنت.')}</span>
            </li>
            <li>
              <b>{L('Scan the code with the camera', 'صوّر الكود بالكاميرا')}</b>
              <span className="muted">{L('or type the address into the browser.', 'أو اكتب العنوان في المتصفح.')}</span>
            </li>
            <li>
              <b>{L('Sign in with your account', 'سجّل الدخول بحسابك')}</b>
              <span className="muted">{L('Trainee, trainer, teacher, supervisor or manager: the same address for everyone.', 'متدرب أو مدرب أو مدرس أو مشرف أو مدير: نفس العنوان للكل.')}</span>
            </li>
            <li>
              <b>{L('Add it to your home screen', 'أضفه للشاشة الرئيسية')}</b>
              <span className="muted">
                {L('Android (Chrome): ⋮ menu → Add to Home screen. iPhone/iPad (Safari): Share → Add to Home Screen. Windows or Mac (Chrome/Edge): the install icon in the address bar, or ⋮ → Save and share → Install.',
                  'أندرويد (كروم): القائمة ⋮ ← إضافة إلى الشاشة الرئيسية. آيفون/آيباد (سفاري): مشاركة ← إضافة إلى الشاشة الرئيسية. ويندوز أو ماك (كروم/إيدج): أيقونة التثبيت في شريط العنوان، أو ⋮ ← حفظ ومشاركة ← تثبيت.')}
              </span>
            </li>
          </ol>}
        </div>
        {addr.https && addr.https !== main && (
          <div className="join-cert">
            <p>
              <b>{L('Full app mode (optional).', 'وضع التطبيق الكامل (اختياري).')}</b>{' '}
              {L('Installs like an app and keeps working away from the centre. Once per device: download the centre certificate and install it, then use the secure address.',
                'يتثبت زي التطبيق ويفضل شغال بعيد عن المركز. مرة واحدة لكل جهاز: نزّل شهادة المركز وثبّتها، وبعدين استخدم العنوان الآمن.')}
            </p>
            <p><a className="button" href="/vtc-center-ca.crt" download>{L('Download certificate', 'تحميل الشهادة')}</a> <code>{addr.https}</code></p>
          </div>
        )}
      </section>

      <section className="card join-card join-sync">
        <h2>{L('Online sync', 'المزامنة أونلاين')}</h2>
        {!hub ? (
          <p className="muted">{L('Not set up. Everything works on the local network; add the hub address and centre key to sync to your online dashboard.',
            'غير مفعّلة. كل شيء شغال على الشبكة المحلية؛ أضف عنوان السيرفر ومفتاح المركز للمزامنة مع لوحة التحكم أونلاين.')}</p>
        ) : (
          <p>
            <span className={`pill ${healthy ? 'pill-ok' : 'pill-alert'}`}>{healthy ? L('Synced', 'متزامن') : L('Waiting for internet', 'في انتظار الإنترنت')}</span>{' '}
            {L('Last upload', 'آخر رفع')}: <b>{ago(up?.last_success_at ?? null)}</b> · {L('records sent', 'سجلات مرفوعة')}: <b>{up?.statements_sent ?? 0}</b>
            {!healthy && up?.last_error && <><br /><span className="muted join-err">{up.last_error.slice(0, 160)}</span></>}
          </p>
        )}
      </section>

      <p className="join-noprint join-actions">
        {!small && <PrintButton label={L('Print this page', 'اطبع الصفحة')} />}
        <a className="button primary" href="/login">{L('Sign in', 'تسجيل الدخول')}</a>
      </p>
    </div>
  );
}
