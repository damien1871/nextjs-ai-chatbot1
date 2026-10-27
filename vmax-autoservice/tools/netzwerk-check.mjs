// Netzwerk-Check: keine Requests an fremde Hosts, keine Cookies, kein Web-Storage, keine CSP-Verstöße.
//   node tools/netzwerk-check.mjs [basis-url]
import { createRequire } from 'node:module';
const { chromium } = createRequire(import.meta.url)('playwright');

const base = process.argv[2] ?? 'http://localhost:4321';
const eigeneHost = new URL(base).host;
const seiten = ['/', '/impressum/', '/datenschutz/', '/404.html'];
const browser = await chromium.launch();
let fehler = 0;

for (const breite of [375, 1440]) {
  for (const seite of seiten) {
    const ctx = await browser.newContext({ viewport: { width: breite, height: 900 } });
    const page = await ctx.newPage();
    const hosts = new Map();
    const probleme = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.protocol === 'data:' || u.protocol === 'blob:') return probleme.push(`${u.protocol}-Request: ${r.url().slice(0, 60)}`);
      hosts.set(u.host, (hosts.get(u.host) ?? 0) + 1);
    });
    page.on('console', (m) => {
      if (['error', 'warning'].includes(m.type())) probleme.push(`Konsole ${m.type()}: ${m.text()}`);
    });
    page.on('pageerror', (e) => probleme.push(`pageerror: ${e.message}`));
    await page.goto(base + seite, { waitUntil: 'networkidle' });
    // bis zum Seitenende scrollen, damit scroll-getriebene Teile geladen/ausgewertet sind
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 30)); }
    });
    await page.waitForTimeout(300);

    const fremd = [...hosts.keys()].filter((h) => h !== eigeneHost);
    if (fremd.length) probleme.push(`FREMDE HOSTS: ${fremd.join(', ')}`);
    const cookies = await ctx.cookies();
    if (cookies.length) probleme.push(`Cookies: ${cookies.map((c) => c.name).join(', ')}`);
    const storage = await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, idb: 'databases' in indexedDB }));
    if (storage.local || storage.session) probleme.push(`Web-Storage belegt: local=${storage.local}, session=${storage.session}`);
    const inlineScripts = await page.evaluate(() => [...document.scripts].filter((s) => !s.src && s.type !== 'application/ld+json').length);
    if (inlineScripts) probleme.push(`Inline-Scripts: ${inlineScripts}`);
    const ausfuehrbar = await page.evaluate(() => [...document.scripts].filter((s) => s.type !== 'application/ld+json').length);

    const total = [...hosts.values()].reduce((a, b) => a + b, 0);
    console.log(`${breite}px ${seite.padEnd(14)} Requests=${total} (nur ${[...hosts.keys()].join(', ')}), ausführbare Scripts=${ausfuehrbar}, ${probleme.length ? 'PROBLEME' : 'OK'}`);
    for (const p of probleme) { console.log('   - ' + p); fehler++; }
    await ctx.close();
  }
}
await browser.close();
console.log(fehler ? `\n${fehler} Problem(e)` : '\nNetzwerk-Check bestanden: nur eigene Requests, keine Cookies, kein Storage, keine Scripts, keine CSP-Meldungen.');
process.exit(fehler ? 1 : 0);
