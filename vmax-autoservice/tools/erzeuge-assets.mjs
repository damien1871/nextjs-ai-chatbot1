// Einmalig ausführen (Ergebnis liegt in public/ und ist eingecheckt):
//   node tools/erzeuge-assets.mjs
// Erzeugt Favicon-Set (PNG, ICO) und das Open-Graph-Bild aus rein typografischen Elementen.
// Benötigt Playwright (nicht Teil der Projekt-Abhängigkeiten) und die installierten @fontsource-Pakete.
import { createRequire } from 'node:module';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = new URL('../', import.meta.url).pathname;
const pub = join(root, 'public');
const tmp = mkdtempSync(join(tmpdir(), 'vmax-assets-'));
const fontDir = join(root, 'node_modules/@fontsource/barlow-condensed/files');
const fontUrl = (w) => pathToFileURL(join(fontDir, `barlow-condensed-latin-${w}-normal.woff2`)).href;

const browser = await chromium.launch();

// --- Favicons ---------------------------------------------------------------
const svg = readFileSync(join(pub, 'favicon.svg'), 'utf8');
async function png(size, datei) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  const html = join(tmp, `icon-${size}.html`);
  writeFileSync(html, `<style>html,body{margin:0}svg{display:block;width:${size}px;height:${size}px}</style>${svg}`);
  await page.goto(pathToFileURL(html).href);
  const buf = await page.screenshot({ type: 'png' });
  await page.close();
  if (datei) writeFileSync(join(pub, datei), buf);
  return buf;
}
await png(180, 'apple-touch-icon.png');
await png(192, 'icon-192.png');
await png(512, 'icon-512.png');
const png32 = await png(32);

// ICO-Container mit einem eingebetteten 32x32-PNG
const kopf = Buffer.alloc(22);
kopf.writeUInt16LE(0, 0); kopf.writeUInt16LE(1, 2); kopf.writeUInt16LE(1, 4);
kopf.writeUInt8(32, 6); kopf.writeUInt8(32, 7); kopf.writeUInt8(0, 8); kopf.writeUInt8(0, 9);
kopf.writeUInt16LE(1, 10); kopf.writeUInt16LE(32, 12);
kopf.writeUInt32LE(png32.length, 14); kopf.writeUInt32LE(22, 18);
writeFileSync(join(pub, 'favicon.ico'), Buffer.concat([kopf, png32]));

// --- Open-Graph-Bild --------------------------------------------------------
const rasterSvg = pathToFileURL(join(pub, 'raster.svg')).href;
const ogHtml = join(tmp, 'og.html');
writeFileSync(ogHtml, `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:BC;font-weight:700;src:url(${fontUrl(700)})}
@font-face{font-family:BC;font-weight:600;src:url(${fontUrl(600)})}
*{box-sizing:border-box}
html,body{margin:0}
body{width:1200px;height:630px;background:#1c1f22 url(${rasterSvg}) -1px -1px/64px 64px;color:#ecebe4;font-family:BC,sans-serif;position:relative;overflow:hidden}
.name{position:absolute;left:72px;top:96px;font-weight:700;font-size:200px;line-height:.86;letter-spacing:-.005em}
.sub{position:absolute;left:76px;top:400px;font-weight:600;font-size:60px;line-height:1}
.mass{position:absolute;left:76px;right:72px;top:500px;height:18px;border-left:2px solid #f5c400;border-right:2px solid #f5c400}
.mass::after{content:"";position:absolute;left:0;right:0;top:8px;height:2px;background:#f5c400}
.info{position:absolute;left:76px;top:535px;font-weight:600;font-size:40px;color:#a9b0b6}
</style>
<div class="name">V-MAX<br>Autoservice</div>
<div class="sub">Kfz-Werkstatt Groß-Umstadt</div>
<div class="mass"></div>
<div class="info">Mo–Sa 9:00–18:00 Uhr&nbsp;&nbsp;&nbsp;&nbsp;06078 9675046</div>`);
const og = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await og.goto(pathToFileURL(ogHtml).href);
await og.evaluate(() => document.fonts.ready);
writeFileSync(join(pub, 'og-image.png'), await og.screenshot({ type: 'png' }));

await browser.close();
console.log('Assets erzeugt: apple-touch-icon.png, icon-192.png, icon-512.png, favicon.ico, og-image.png');
