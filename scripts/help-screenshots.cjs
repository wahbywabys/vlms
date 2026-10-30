// Screenshots for the in-app Instructions (تعليمات), see docs/help.md.
//   BASE=http://localhost node scripts/help-screenshots.cjs ar && ... en, then python3 scripts/help-screenshots.py
const { chromium } = require('playwright');
const base = process.env.BASE ?? 'http://localhost';
const lang = process.argv[2] || 'ar';
const out = (n) => `helpshots/${lang}/${n}.png`;
const T = (en, ar) => (lang === 'ar' ? ar : en);
async function shot(p, name, opts = {}) { await p.waitForTimeout(opts.wait ?? 900); await p.screenshot({ path: out(name), fullPage: false }); }
async function clickText(p, en, ar) { await p.getByText(T(en, ar), { exact: false }).first().click({ timeout: 8000 }); }
async function as(b, email, fn) {
  const ctx = await b.newContext({ viewport: { width: 390, height: 780 }, deviceScaleFactor: 2 });
  await ctx.addCookies([{ name: 'lang', value: lang, url: base }]);
  const p = await ctx.newPage();
  if (email) {
    await p.goto(base + '/login');
    await p.fill('input[type=email], input[name=email]', email);
    await p.fill('input[type=password]', 'demo1234');
    await Promise.all([p.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20000 }), p.click('button[type=submit]')]);
  }
  try { await fn(p); } catch (e) { console.error(email, e.message.split('\n')[0]); }
  await ctx.close();
}
const go = (p, path) => p.goto(base + path, { waitUntil: 'networkidle' }).catch(() => {});
(async () => {
  require('fs').mkdirSync(`helpshots/${lang}`, { recursive: true });
  const b = await chromium.launch();
  await as(b, null, async (p) => {
    await go(p, '/join'); await shot(p, 'join');
    await go(p, '/login'); await p.fill('input[type=email], input[name=email]', 'student@vtc.example'); await shot(p, 'login');
  });
  await as(b, 'student@vtc.example', async (p) => {
    await shot(p, 'student-home');
    await go(p, '/student/machine'); await shot(p, 'student-machine-scan');
    await p.getByRole('button', { name: /CNC2-L0[3-9]|CNC2-L1/ }).first().click(); await shot(p, 'student-machine-precheck', { wait: 1800 });
    await go(p, '/student/lab'); await shot(p, 'student-lab');
    await go(p, '/student/quiz'); await shot(p, 'student-quiz');
    await go(p, '/student/logbook'); await shot(p, 'student-logbook');
    await go(p, '/student/private'); await shot(p, 'student-private');
  });
  await as(b, 'trainer@vtc.example', async (p) => {
    await shot(p, 'trainer-floor', { wait: 1500 });
    await p.locator('.stn').first().click(); await shot(p, 'trainer-score', { wait: 1200 });
    await go(p, '/trainer/machines'); await shot(p, 'trainer-machines');
    await clickText(p, 'Scan a machine', 'امسح ماكينة'); await shot(p, 'trainer-scan');
    await clickText(p, 'QR stickers', 'ملصقات QR'); await shot(p, 'trainer-stickers', { wait: 1500 });
    await go(p, '/trainer/vlab'); await shot(p, 'trainer-vlab');
    await go(p, '/trainer/risk'); await shot(p, 'trainer-risk');
  });
  await as(b, 'teacher@vtc.example', async (p) => { await shot(p, 'teacher-bank'); await go(p, '/teacher/new'); await shot(p, 'teacher-new'); });
  await as(b, 'supervisor@vtc.example', async (p) => { await shot(p, 'supervisor-signoff'); await p.mouse.wheel(0, 700); await shot(p, 'supervisor-signoff-2'); });
  await as(b, 'director@vtc.example', async (p) => {
    await shot(p, 'director-home');
    await go(p, '/director/programs'); await shot(p, 'director-programs');
    await go(p, '/director/machines'); await shot(p, 'director-machines');
    await clickText(p, 'QR stickers', 'ملصقات QR'); await shot(p, 'director-stickers', { wait: 1500 });
    await go(p, '/director/risk'); await shot(p, 'director-risk');
  });
  await b.close();
})();
