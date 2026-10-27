/**
 * Alle Fakten zum Betrieb an einer Stelle (Seite, Footer, JSON-LD).
 * Leere Strings = vom Inhaber noch nicht geliefert -> es erscheint ein sichtbarer [PLATZHALTER: …].
 */
export const betrieb = {
  name: 'V-MAX Autoservice',
  strasse: 'Marie-Curie-Straße 10',
  plz: '64823',
  ort: 'Groß-Umstadt',
  zusatz: 'Gewerbegebiet',
  telefonAnzeige: '06078 9675046',
  telefonHref: '+4960789675046',
  telefonSchema: '+49 6078 9675046',
  // Koordinaten laut Briefing; vor Go-live in Google Maps gegenprüfen.
  geo: { lat: 49.8729, lon: 8.9173 },
  bewertung: { schnitt: '5,0', anzahl: 47 },

  // Noch nicht geliefert:
  email: '',
  googleProfilUrl: '',
  bewertungStand: '', // z. B. '27.10.2026'
} as const;

export const oeffnungszeiten = [
  { tag: 'Montag', kurz: 'Mo', schema: 'Monday', von: '9:00', bis: '18:00' },
  { tag: 'Dienstag', kurz: 'Di', schema: 'Tuesday', von: '9:00', bis: '18:00' },
  { tag: 'Mittwoch', kurz: 'Mi', schema: 'Wednesday', von: '9:00', bis: '18:00' },
  { tag: 'Donnerstag', kurz: 'Do', schema: 'Thursday', von: '9:00', bis: '18:00' },
  { tag: 'Freitag', kurz: 'Fr', schema: 'Friday', von: '9:00', bis: '18:00' },
  { tag: 'Samstag', kurz: 'Sa', schema: 'Saturday', von: '9:00', bis: '18:00' },
  { tag: 'Sonntag', kurz: 'So', schema: 'Sunday', von: null, bis: null },
] as const;

declare const process: { env: Record<string, string | undefined> };

/**
 * Solange Platzhalter sichtbar sind, soll die Seite nicht in Suchmaschinen landen.
 * Beim Go-live mit SEITE_LIVE=1 bauen (siehe README).
 */
export const NOINDEX = process.env.SEITE_LIVE !== '1';

export const routeUrl =
  'https://www.google.com/maps/dir/?api=1&destination=' +
  encodeURIComponent(`${betrieb.strasse}, ${betrieb.plz} ${betrieb.ort}`);

export const seo = {
  titel: 'Kfz-Werkstatt Groß-Umstadt | V-MAX Autoservice',
  beschreibung:
    'Kfz-Werkstatt Groß-Umstadt: V-MAX Autoservice, Ihre freie Werkstatt im Gewerbegebiet. Kurzfristige Termine, Mo–Sa 9–18 Uhr, Telefon 06078 9675046.',
};
