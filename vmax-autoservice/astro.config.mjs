import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import tailwindcss from '@tailwindcss/vite';

// Die echte Domain wird beim Build per Umgebungsvariable gesetzt:
//   SITE_URL=https://www.beispiel.de npm run build
// Bis dahin steht hier eine reservierte Platzhalter-Domain (siehe README).
const site = process.env.SITE_URL ?? 'https://platzhalter-domain.example';

export default defineConfig({
  site,
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  devToolbar: { enabled: false },
  integrations: [sitemap({ filter: (page) => !page.includes('/404') })],
  build: {
    // CSP ohne 'unsafe-inline': Astro darf kleine Stylesheets nicht in <style> einbetten.
    inlineStylesheets: 'never',
  },
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Keine data:-URIs für Schriften/Bilder: font-src fällt auf default-src 'self' zurück.
      assetsInlineLimit: 0,
    },
  },
});
