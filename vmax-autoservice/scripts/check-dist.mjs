// Prüft dist/ nach dem Build auf Verstöße gegen die CSP (ohne 'unsafe-inline') und auf Fremd-URLs.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const root = new URL('../dist/', import.meta.url).pathname;
const fehler = [];

function* dateien(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    statSync(p).isDirectory() ? yield* dateien(p) : yield p;
  }
}

for (const datei of dateien(root)) {
  const rel = datei.slice(root.length);
  const endung = extname(datei);

  if (endung === '.html') {
    const html = readFileSync(datei, 'utf8');
    if (/<style[\s>]/i.test(html)) fehler.push(`${rel}: <style>-Block (verstößt gegen style-src 'self')`);
    if (/\sstyle\s*=/i.test(html)) fehler.push(`${rel}: style-Attribut (verstößt gegen style-src 'self')`);
    if (/\son[a-z]+\s*=\s*["']/i.test(html)) fehler.push(`${rel}: Inline-Event-Handler`);
    for (const m of html.matchAll(/<script\b([^>]*)>/gi)) {
      const attrs = m[1];
      if (!/\bsrc\s*=/.test(attrs) && !/type\s*=\s*["']application\/ld\+json["']/.test(attrs))
        fehler.push(`${rel}: Inline-<script> (${attrs.trim()})`);
    }
    // Ressourcen, die der Browser beim Laden von fremden Hosts holen würde
    for (const m of html.matchAll(/<(script|img|source|iframe|video|audio|link)\b[^>]*>/gi)) {
      const tag = m[0];
      if (/<link\b/i.test(tag) && /rel\s*=\s*["'](canonical|alternate|sitemap)["']/i.test(tag)) continue;
      if (/\b(?:src|srcset|href)\s*=\s*["']\s*(?:https?:)?\/\//i.test(tag)) fehler.push(`${rel}: externe Ressource ${tag}`);
    }
  }

  if (endung === '.css') {
    const css = readFileSync(datei, 'utf8');
    if (/url\(\s*["']?(?:https?:)?\/\//i.test(css) || /@import\s+(?:url\()?["']?(?:https?:)?\/\//i.test(css))
      fehler.push(`${rel}: externe URL im CSS`);
    if (/url\(\s*["']?data:/i.test(css)) fehler.push(`${rel}: data:-URI im CSS (Schrift/Bild sollte Datei sein)`);
  }
}

if (fehler.length) {
  console.error('check-dist: FEHLER\n - ' + fehler.join('\n - '));
  process.exit(1);
}
console.log('check-dist: OK (keine Inline-Styles/-Scripts, keine externen Ressourcen)');
