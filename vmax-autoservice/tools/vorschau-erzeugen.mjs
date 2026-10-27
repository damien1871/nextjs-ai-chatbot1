// Erzeugt aus dist/ eigenständige Vorschau-Dateien (vorschau/*.html), die sich per Doppelklick öffnen lassen.
// CSS, Schriften und Raster werden eingebettet. NUR zur Ansicht: Die echte Seite bleibt das Ergebnis von "npm run build".
//   npm run build && node tools/vorschau-erzeugen.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname } from 'node:path';

const dist = new URL('../dist/', import.meta.url).pathname;
const out = new URL('../vorschau/', import.meta.url).pathname;
mkdirSync(out, { recursive: true });

const mime = { '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png' };
const dataUri = (pfad) => `data:${mime[extname(pfad)]};base64,${readFileSync(dist + pfad.replace(/^\//, '')).toString('base64')}`;

const seiten = { '': 'index.html', impressum: 'impressum.html', datenschutz: 'datenschutz.html' };

for (const [ordner, ziel] of Object.entries(seiten)) {
  let html = readFileSync(`${dist}${ordner ? ordner + '/' : ''}index.html`, 'utf8');

  // CSS einbetten
  html = html.replace(/<link rel="stylesheet" href="([^"]+\.css)"\s*\/?>/g, (_, href) => {
    let css = readFileSync(dist + href.replace(/^\//, ''), 'utf8');
    css = css.replace(/,\s*url\([^)]*\.woff\)\s*format\(["']woff["']\)/g, ''); // nur woff2 behalten
    css = css.replace(/url\((["']?)(\/[^)"']+\.(?:woff2|svg|png))\1\)/g, (_m, _q, p) => `url(${dataUri(p)})`);
    return `<style>${css}</style>`;
  });

  // nicht benötigte Head-Verweise entfernen
  html = html.replace(/<link rel="(?:preload|manifest|icon|apple-touch-icon)"[^>]*>/g, '');

  // interne Links auf die Vorschau-Dateien umbiegen
  html = html
    .replace(/href="\/impressum\/"/g, 'href="impressum.html"')
    .replace(/href="\/datenschutz\/"/g, 'href="datenschutz.html"')
    .replace(/href="\/#/g, 'href="index.html#')
    .replace(/href="\/"/g, 'href="index.html"');

  html = html.replace('<body', '<body data-vorschau');
  writeFileSync(out + ziel, html);
  console.log(`vorschau/${ziel}  ${(html.length / 1024).toFixed(0)} KB`);
}
