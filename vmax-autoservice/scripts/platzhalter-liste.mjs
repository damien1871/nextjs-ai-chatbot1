// Listet alle sichtbaren [PLATZHALTER: …] aus dist/ (nach "npm run build"), mit den Seiten, auf denen sie vorkommen.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const funde = new Map();

function* dateien(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? yield* dateien(p) : yield p;
  }
}

for (const datei of dateien(root)) {
  if (!datei.endsWith('.html')) continue;
  const seite = '/' + datei.slice(root.length).replace(/index\.html$/, '');
  const html = readFileSync(datei, 'utf8');
  for (const m of html.matchAll(/\[PLATZHALTER: ([^\]]+)\]/g)) {
    const text = m[1];
    if (!funde.has(text)) funde.set(text, new Set());
    funde.get(text).add(seite);
  }
}

for (const [text, seiten] of [...funde].sort((a, b) => a[0].localeCompare(b[0], 'de'))) {
  console.log(`- ${text}  (${[...seiten].join(', ')})`);
}
console.log(`\n${funde.size} verschiedene Platzhalter`);
