// Screenshots in 375, 768 und 1440 px + Konsolen-/CSP-Meldungen.
//   node tools/screenshots.mjs <ausgabeordner> [url] [runde]
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
const { chromium } = createRequire(import.meta.url)('playwright');

const [out, base = 'http://localhost:4321', runde = '1'] = process.argv.slice(2);
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
for (const [breite, hoehe] of [[375, 812], [768, 1024], [1440, 900]]) {
  const ctx = await browser.newContext({ viewport: { width: breite, height: hoehe }, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const meldungen = [];
  page.on('console', (m) => ['error', 'warning'].includes(m.type()) && meldungen.push(`${m.type()}: ${m.text()}`));
  page.on('pageerror', (e) => meldungen.push(`pageerror: ${e.message}`));
  await page.goto(base + '/', { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  // horizontales Scrollen prüfen
  const ueberlauf = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  await page.screenshot({ path: join(out, `r${runde}-${breite}-oben.png`) });
  await page.screenshot({ path: join(out, `r${runde}-${breite}-voll.png`), fullPage: true });
  console.log(`${breite}px: Überlauf=${ueberlauf}px, Meldungen=${meldungen.length ? '\n  ' + meldungen.join('\n  ') : 'keine'}`);
  await ctx.close();
}
await browser.close();
