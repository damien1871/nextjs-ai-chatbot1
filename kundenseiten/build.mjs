// Erzeugt 30 eigenständige Webseiten-Entwürfe (je eine index.html) plus Übersicht.
// Aufruf: node kundenseiten/build.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = dirname(fileURLToPath(import.meta.url));

/* ---------- Leistungen je Branche (branchenüblich, vor Start abstimmen) ---------- */
const LEISTUNGEN = {
  schuh: [
    ["Besohlungen", "Neue Sohlen aus Leder oder Gummi, damit das Paar noch Jahre hält."],
    ["Absätze", "Abgelaufene Absätze werden ersetzt, oft noch am selben Tag."],
    ["Schaftänderungen", "Stiefel enger, weiter oder kürzer, passend zum Bein."],
    ["Reparaturen aller Art", "Nähte, Klebungen, Reißverschlüsse und Ösen."],
  ],
  schneider: [
    ["Kürzen und säumen", "Hosen, Röcke, Ärmel und Kleider auf die richtige Länge."],
    ["Enger und weiter machen", "Bund, Taille und Seitennähte so, dass es sitzt."],
    ["Reißverschlüsse", "Neue Reißverschlüsse für Jacken, Hosen und Taschen."],
    ["Flicken und ausbessern", "Risse, Löcher und offene Nähte sauber repariert."],
  ],
  friseur: [
    ["Schneiden", "Für Damen, Herren und Kinder, mit Beratung vor dem ersten Schnitt."],
    ["Farbe und Strähnen", "Von der Ansatzfarbe bis zur neuen Haarfarbe."],
    ["Föhnen und Stecken", "Frisuren für den Alltag und für Feste."],
    ["Pflege", "Kuren und Tipps für zu Hause."],
  ],
  baecker: [
    ["Brot", "Jeden Morgen frisch aus dem Ofen."],
    ["Brötchen und Semmeln", "Für das Frühstück zu Hause oder auf die Hand."],
    ["Kuchen und Gebäck", "Süßes für den Nachmittag und für Gäste."],
    ["Vorbestellen", "Größere Mengen legen wir nach Anruf zurück."],
  ],
  metzger: [
    ["Fleisch aus der Theke", "Zugeschnitten nach Wunsch, mit Rat zur Zubereitung."],
    ["Wurst und Aufschnitt", "Für die Brotzeit und für den Vorrat."],
    ["Für Grill und Pfanne", "Bratwürste, Steaks und Mariniertes in der Saison."],
    ["Platten auf Bestellung", "Für Feiern und Feste, nach telefonischer Absprache."],
  ],
  blumen: [
    ["Sträuße", "Frisch gebunden, nach Ihrem Wunsch oder nach unserem Vorschlag."],
    ["Hochzeit und Feste", "Brautstrauß, Tischschmuck und Dekoration."],
    ["Trauerfloristik", "Kränze, Gestecke und Schalen, in Ruhe besprochen."],
    ["Pflanzen", "Für Zimmer, Balkon und Garten."],
  ],
  gasthaus: [
    ["Essen", "Küche, wie man sie im Dorfkrug erwartet."],
    ["Trinken", "Ein Bier, eine Schorle, ein Kaffee nach dem Spaziergang."],
    ["Feiern", "Für Geburtstage und Familienfeste fragen Sie am besten telefonisch an."],
  ],
  fusspflege: [
    ["Fußpflege", "Nägel kürzen, Hornhaut entfernen, Haut pflegen."],
    ["Nagelpflege", "Gepflegte Nägel an Händen und Füßen."],
    ["Termine", "Behandelt wird nach Absprache. Rufen Sie einfach an."],
  ],
  eis: [
    ["In der Waffel oder im Becher", "Kugel für Kugel, zum Mitnehmen."],
    ["Eisbecher", "Für alle, die sich hinsetzen und Zeit lassen möchten."],
    ["Für zu Hause", "Fragen Sie an der Theke nach Eis zum Mitnehmen in der Box."],
  ],
  kfz: [
    ["Inspektion und Wartung", "Nach Herstellervorgabe, für alle Marken."],
    ["Reparaturen", "Bremsen, Auspuff, Kupplung, Fahrwerk und mehr."],
    ["Vorbereitung zur Hauptuntersuchung", "Wir prüfen vorab, was gemacht werden muss."],
    ["Reifen und Räder", "Wechsel, Montage und Auswuchten."],
  ],
  raum: [
    ["Autosattlerei", "Sitze, Verdecke und Innenausstattung neu bezogen oder repariert."],
    ["Polstern", "Sessel, Stühle und Sofas aufgearbeitet statt ersetzt."],
    ["Raumausstattung", "Gardinen, Bodenbeläge und Wandbekleidung."],
  ],
  nails: [
    ["Maniküre", "Formen, feilen, pflegen."],
    ["Modellage", "Verlängerung und Verstärkung mit Gel."],
    ["Nail Art", "Farben und Motive nach Ihrem Wunsch."],
  ],
  uhr: [
    ["Restaurierung", "Historische und antike Uhren fachgerecht erhalten."],
    ["Reparatur", "Wenn das Werk steht oder die Uhr falsch geht."],
    ["Reinigung", "Das Werk wird zerlegt, gereinigt und neu geölt."],
    ["Ersatzteile", "Fehlende Teile werden von Hand angefertigt."],
  ],
  imker: [
    ["Honig", "Direkt vom Imker, aus der Region um Brakel."],
    ["Ab Hof", "Am besten vorher anfragen, ob jemand da ist."],
    ["Für Geschenke", "Gläser in kleinen Mengen oder im Karton."],
  ],
};

/* ---------- Motive (einfache Strichzeichnungen) ---------- */
const S = 'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';
const rot = (n, fn) => Array.from({ length: n }, (_, i) => fn((360 / n) * i)).join("");
const MOTIV = {
  schuh: `<path ${S} d="M28 128c0-34 14-52 34-52h22c8 26 30 34 62 38 22 3 28 12 28 26v8H28z"/><path ${S} d="M28 148h146M62 76v-22h22v22M96 98l14-10M112 106l14-10"/>`,
  schneider: `<path ${S} d="M40 160 150 50"/><ellipse ${S} cx="146" cy="54" rx="6" ry="12" transform="rotate(45 146 54)"/><path ${S} d="M150 50c30-30 40 20 10 30s-60 0-80 30-10 60-50 50"/><path ${S} stroke-dasharray="2 14" d="M24 40h90"/>`,
  friseur: `<circle ${S} cx="58" cy="150" r="20"/><circle ${S} cx="110" cy="158" r="20"/><path ${S} d="M70 134 150 34M102 140 84 34"/><path ${S} d="M150 100v70M150 110h18M150 126h18M150 142h18M150 158h18"/>`,
  baecker: `<path ${S} d="M22 128c0-34 34-58 78-58s78 24 78 58c0 12-8 18-20 18H42c-12 0-20-6-20-18z"/><path ${S} d="M64 84l14 26M96 78l14 28M128 84l12 26"/>`,
  metzger: `<rect ${S} x="30" y="56" width="104" height="70" rx="8"/><circle ${S} cx="116" cy="74" r="5"/><rect ${S} x="134" y="82" width="46" height="16" rx="8"/><path ${S} d="M40 160c20-14 40 14 60 0s40 14 60 0"/>`,
  blumen: `${rot(6, (a) => `<circle ${S} cx="100" cy="46" r="18" transform="rotate(${a} 100 72)"/>`)}<circle cx="100" cy="72" r="10" fill="currentColor"/><path ${S} d="M100 116v66M100 150c-24 0-34-12-36-26 20 0 34 8 36 26zM100 162c20 0 30-10 32-22-18 0-30 6-32 22z"/>`,
  gasthaus: `<rect ${S} x="52" y="70" width="74" height="100" rx="8"/><path ${S} d="M126 92h18a14 14 0 0 1 14 14v24a14 14 0 0 1-14 14h-18M74 92v56M100 92v56"/><path ${S} d="M52 70c-10-22 12-34 24-24 6-18 34-18 38 0 16-8 30 10 12 24"/>`,
  fusspflege: `<path ${S} d="M70 176c-22 0-28-24-22-48s4-44 28-48 34 22 30 50-12 46-36 46z"/><circle ${S} cx="72" cy="52" r="11"/><circle ${S} cx="100" cy="46" r="9"/><circle ${S} cx="122" cy="54" r="8"/><circle ${S} cx="138" cy="68" r="7"/><circle ${S} cx="148" cy="86" r="6"/>`,
  eis: `<path ${S} d="M62 104h76l-38 82z"/><circle ${S} cx="100" cy="70" r="36"/><path ${S} d="M78 128l44 22M122 128l-30 16"/><circle cx="118" cy="26" r="9" fill="currentColor"/>`,
  kfz: `<circle ${S} cx="100" cy="100" r="46"/><circle ${S} cx="100" cy="100" r="16"/>${rot(8, (a) => `<path ${S} d="M100 54V34" transform="rotate(${a} 100 100)"/>`)}`,
  raum: `<path ${S} d="M52 110V70a18 18 0 0 1 18-18h60a18 18 0 0 1 18 18v40"/><path ${S} d="M30 106a14 14 0 0 1 28 0v22h84v-22a14 14 0 0 1 28 0v44H30zM46 150v22M154 150v22"/><path ${S} stroke-dasharray="2 12" d="M70 76h60"/>`,
  nails: `<rect ${S} x="84" y="24" width="32" height="62" rx="6"/><rect ${S} x="60" y="86" width="80" height="92" rx="22"/><path ${S} d="M78 118v32"/>`,
  uhr: `<circle ${S} cx="100" cy="100" r="78"/>${rot(12, (a) => `<path ${S} d="M100 30v12" transform="rotate(${a} 100 100)"/>`)}<path ${S} d="M100 100V56M100 100l30 18"/><circle cx="100" cy="100" r="6" fill="currentColor"/>`,
  imker: [[100, 64], [66, 122], [134, 122], [100, 180 - 0]].slice(0, 3).map(([x, y]) => `<path ${S} d="M${x} ${y - 36}l31 18v36l-31 18-31-18v-36z"/>`).join("") + `<path ${S} d="M152 44c10-10 22-4 22 6M160 60h14"/>`,
};
const svg = (t, cls = "") => `<svg class="motiv ${cls}" viewBox="0 0 200 200" aria-hidden="true">${MOTIV[t]}</svg>`;

/* ---------- Die 30 Betriebe ---------- */
// Quelle der Stammdaten: öffentliche Branchenverzeichnisse (Stand der Recherche siehe Übersicht).
const WERKTAGE = (zeit) => [["Montag bis Freitag", zeit]];
const SITES = [
  { slug: "schuhreparatur-fahrenz-freiburg", name: "Schuhreparatur Ronny Fahrenz", kurz: "Fahrenz", t: "schuh", label: "Schuhreparatur", street: "Habsburgerstraße 104", plz: "79104", ort: "Freiburg im Breisgau",
    layout: "plakat", svc: "liste", r: "0", c: { bg: "#2B211B", ink: "#F3E9DC", acc: "#E0A23B", on: "#2B211B", acc2: "#7A4A2B" }, f: { d: "Zilla Slab", b: "Karla", gf: "Zilla+Slab:wght@600;700&family=Karla:wght@400;600", dw: 700 },
    headline: "Schuhe reparieren statt wegwerfen.", lead: "Besohlungen, Absätze und Schaftänderungen in der Habsburgerstraße in Freiburg." },
  { slug: "aenderungsschneiderei-lenz-bilsen", name: "Änderungsschneiderei Beate Lenz", kurz: "Beate Lenz", t: "schneider", label: "Änderungsschneiderei", street: "Kieler Str. 2", plz: "25485", ort: "Bilsen", phone: "04106 658243",
    layout: "massband", svc: "liste", r: ".25rem", c: { bg: "#F6F7F2", ink: "#1F2A44", acc: "#D7263D", on: "#FFFFFF", acc2: "#F2C94C" }, f: { d: "Fraunces", b: "Figtree", gf: "Fraunces:opsz,wght@9..144,600;9..144,800&family=Figtree:wght@400;600", dw: 800 },
    headline: "Passt nicht gibt es nicht.", lead: "Hosen kürzen, Kleider anpassen, Reißverschlüsse erneuern: Beate Lenz ändert Ihre Kleidung in Bilsen." },
  { slug: "h-lounge-friseursalon-dresden", name: "H-Lounge Friseursalon", kurz: "H-Lounge", t: "friseur", label: "Friseursalon", owner: "Inhaberin Anja Herzog-Prauß", street: "Pfotenhauerstraße 109", plz: "01307", ort: "Dresden", phone: "0351 3177566",
    layout: "fenster", svc: "spalten", r: "999px", c: { bg: "#EFE7F1", ink: "#2A1B33", acc: "#7B3FA0", on: "#FFFFFF", acc2: "#F0B7C8" }, f: { d: "Bodoni Moda", b: "Outfit", gf: "Bodoni+Moda:opsz,wght@6..96,500;6..96,700&family=Outfit:wght@300;500", dw: 500 },
    headline: "Zeit für einen guten Schnitt.", lead: "Der Friseursalon von Anja Herzog-Prauß in der Pfotenhauerstraße in Dresden." },
  { slug: "coiffure-adele-stockheim", name: "Coiffure Adele", kurz: "Coiffure Adele", t: "friseur", label: "Friseur", owner: "Friseurmeisterin Sybille Thoma", street: "Josephssiedlung 7", plz: "96342", ort: "Stockheim-Neukenroth", phone: "09265 9144790",
    hours: [["Montag", "geschlossen"], ["Dienstag bis Samstag", "geöffnet, Zeiten bitte telefonisch erfragen"], ["Sonntag", "geschlossen"]],
    layout: "schild", svc: "gross", r: ".5rem", c: { bg: "#F7F0F2", ink: "#3B1D2A", acc: "#B4375A", on: "#FFFFFF", acc2: "#E9C46A" }, f: { d: "Gloock", b: "Albert Sans", gf: "Gloock&family=Albert+Sans:wght@400;600", dw: 400 },
    headline: "Schnitt, Farbe und Zeit für Sie.", lead: "Friseurmeisterin Sybille Thoma frisiert Damen, Herren und Kinder in Neukenroth." },
  { slug: "baeckerei-hopf-ploessberg", name: "Bäckerei Reiner Hopf", kurz: "Bäckerei Hopf", t: "baecker", label: "Bäckerei", street: "Hauptstr. 16", plz: "95703", ort: "Plößberg", phone: "09636 285",
    hours: [["Montag", "geschlossen"], ["Dienstag", "5:30 bis 13:00 und 14:30 bis 17:00"], ["Mittwoch", "5:30 bis 13:00 und 14:30 bis 17:00"], ["Donnerstag", "5:30 bis 13:00"], ["Freitag", "5:30 bis 17:00"], ["Samstag", "5:30 bis 12:00"], ["Sonntag", "geschlossen"]],
    layout: "zettel", svc: "spalten", r: ".3rem", c: { bg: "#1E3A5F", ink: "#FFF4DC", acc: "#F4B942", on: "#1E2A3A", acc2: "#33598C" }, f: { d: "Young Serif", b: "Hanken Grotesk", gf: "Young+Serif&family=Hanken+Grotesk:wght@400;600", dw: 400 },
    headline: "Um halb sechs ist das Brot schon fertig.", lead: "Bäckerei Reiner Hopf an der Hauptstraße in Plößberg." },
  { slug: "baeckerei-fiedler-schwarzenbach", name: "Bäckerei Fiedler", kurz: "Fiedler", t: "baecker", label: "Bäckerei", street: "Rehauer Str. 7", plz: "95126", ort: "Schwarzenbach an der Saale", phone: "09284 356",
    layout: "tafel", svc: "liste", r: ".2rem", c: { bg: "#F2EFE6", ink: "#1F3B34", acc: "#C7772E", on: "#FFFFFF", acc2: "#F6C177", board: "#1F3B34", chalk: "#F2EFE6" }, f: { d: "Kalam", b: "Bitter", gf: "Kalam:wght@400;700&family=Bitter:wght@400;600", dw: 700 },
    headline: "Frisch aus der Backstube.", lead: "Brot, Brötchen und Gebäck von der Bäckerei Fiedler in Schwarzenbach an der Saale." },
  { slug: "metzgerei-wimmer-bad-windsheim", name: "Metzgerei Wimmer", kurz: "Wimmer", t: "metzger", label: "Metzgerei", street: "Illesheimer Str. 9", plz: "91438", ort: "Bad Windsheim", phone: "09841 2022",
    hours: [["Montag", "Ruhetag"], ["Dienstag bis Samstag", "geöffnet, Zeiten bitte telefonisch erfragen"]],
    layout: "schild", svc: "spalten", r: "0", kachel: true, c: { bg: "#FFFFFF", ink: "#1B1B1B", acc: "#C1121F", on: "#FFFFFF", acc2: "#DCE6EC" }, f: { d: "Alfa Slab One", b: "Libre Franklin", gf: "Alfa+Slab+One&family=Libre+Franklin:wght@400;600", dw: 400 },
    headline: "Fleisch und Wurst vom Metzger.", lead: "Metzgerei Wimmer in der Illesheimer Straße in Bad Windsheim. Montags ist Ruhetag." },
  { slug: "metzgerei-polster-moehrendorf", name: "Metzgerei Polster", kurz: "Polster", t: "metzger", label: "Metzgerei", street: "Röttenbacher Str. 6", plz: "91096", ort: "Möhrendorf", phone: "09133 4688",
    layout: "spalte", svc: "gross", r: ".4rem", c: { bg: "#FBE9E7", ink: "#4A0D14", acc: "#8E1B2B", on: "#FBE9E7", acc2: "#F4A7A0" }, f: { d: "Rozha One", b: "Manrope", gf: "Rozha+One&family=Manrope:wght@400;600", dw: 400 },
    headline: "Vom Metzger im Ort.", lead: "Metzgerei Polster in der Röttenbacher Straße in Möhrendorf." },
  { slug: "blumenhaus-ortmann-sanitz", name: "Blumenhaus & Gärtnerei Ortmann", kurz: "Ortmann", t: "blumen", label: "Blumenhaus und Gärtnerei", street: "Rostocker Str. 18", plz: "18190", ort: "Sanitz", phone: "038209 229",
    layout: "fenster", svc: "liste", r: "1.2rem", c: { bg: "#E8F0E4", ink: "#1E3524", acc: "#3F7D4E", on: "#FFFFFF", acc2: "#F2A6B6" }, f: { d: "Caprasimo", b: "Rethink Sans", gf: "Caprasimo&family=Rethink+Sans:wght@400;600", dw: 400 },
    headline: "Blumenhaus und Gärtnerei unter einem Dach.", lead: "Sträuße, Pflanzen und Beratung bei Ortmann in Sanitz." },
  { slug: "blumenhaus-kuechler-offenbach", name: "Blumenhaus Küchler", kurz: "Küchler", t: "blumen", label: "Blumenhaus", street: "Arendsstr. 8", plz: "63075", ort: "Offenbach am Main", phone: "069 863420",
    layout: "rund", svc: "liste", r: "0", c: { bg: "#F4F4F0", ink: "#2E2A3B", acc: "#6C5B9E", on: "#FFFFFF", acc2: "#C9D6B8" }, f: { d: "Cormorant Garamond", b: "Karla", gf: "Cormorant+Garamond:wght@500;600&family=Karla:wght@400;600", dw: 500 },
    headline: "Blumen für die Tage, die zählen.", lead: "Pflanzen, Hochzeitsfloristik, Trauerfloristik und Friedhofsservice vom Blumenhaus Küchler in Offenbach.",
    services: [["Hochzeitsfloristik", "Brautstrauß, Anstecker und Tischschmuck."], ["Trauerfloristik", "Kränze, Gestecke und Schalen, in Ruhe besprochen."], ["Friedhofsservice", "Bepflanzung und Pflege von Gräbern."], ["Pflanzen", "Für Zimmer, Balkon und Garten."]] },
  { slug: "blumenhaus-burkardt-wiesbaden", name: "Blumenhaus Burkardt", kurz: "Burkardt", t: "blumen", label: "Blumenhaus", street: "Flandernstraße 28", plz: "65191", ort: "Wiesbaden", phone: "0611 540602",
    layout: "plakat", svc: "spalten", r: "999px", c: { bg: "#FFF6F0", ink: "#25140F", acc: "#E5446D", on: "#FFFFFF", acc2: "#2F6B4F" }, f: { d: "DM Serif Display", b: "Sora", gf: "DM+Serif+Display&family=Sora:wght@300;600", dw: 400 },
    headline: "Ein Strauß sagt es einfacher.", lead: "Frische Blumen aus der Flandernstraße in Wiesbaden." },
  { slug: "dorfkrug-admannshagen-bargeshagen", name: "Dorfkrug", kurz: "Dorfkrug", t: "gasthaus", label: "Gaststätte", street: "Bargeshäger Str. 2", plz: "18211", ort: "Admannshagen-Bargeshagen", phone: "038203 81116",
    layout: "tafel", svc: "gross", r: ".2rem", c: { bg: "#F5EBDD", ink: "#33261D", acc: "#A8641A", on: "#FFFFFF", acc2: "#D9A441", board: "#33261D", chalk: "#F5EBDD" }, f: { d: "Caveat Brush", b: "Vollkorn", gf: "Caveat+Brush&family=Vollkorn:wght@400;600", dw: 400 },
    headline: "Der Krug im Dorf.", lead: "Essen, trinken und zusammensitzen im Dorfkrug in Admannshagen-Bargeshagen." },
  { slug: "aenderungsschneiderei-dokuz-osnabrueck", name: "Änderungsschneiderei Dokuz", kurz: "Dokuz", t: "schneider", label: "Änderungsschneiderei", street: "Meller Straße 291", ort: "Osnabrück", phone: "0541 86013031",
    hours: [["Montag bis Freitag", "9:00 bis 18:00"], ["Samstag", "bis 13:00"], ["Sonntag", "geschlossen"]],
    layout: "zettel", svc: "liste", r: ".6rem", c: { bg: "#EDF3F7", ink: "#14213D", acc: "#1D6FA3", on: "#FFFFFF", acc2: "#F77F00" }, f: { d: "Bricolage Grotesque", b: "Bricolage Grotesque", gf: "Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800", dw: 800 },
    headline: "Zu lang, zu weit, zu eng? Wird geändert.", lead: "Änderungsschneiderei Dokuz in der Meller Straße in Osnabrück." },
  { slug: "fusspflege-studio-silke-ziesendorf", name: "Fuß- und Nagelpflege Studio Silke", kurz: "Studio Silke", t: "fusspflege", label: "Fuß- und Nagelpflege", street: "Talstraße 28", plz: "18059", ort: "Ziesendorf", phone: "038207 76377",
    layout: "rund", svc: "spalten", r: "999px", c: { bg: "#EAF6F4", ink: "#173B3A", acc: "#2A9D8F", on: "#FFFFFF", acc2: "#F6BD60" }, f: { d: "Marcellus", b: "Figtree", gf: "Marcellus&family=Figtree:wght@400;600", dw: 400 },
    headline: "Gut zu Fuß.", lead: "Fuß- und Nagelpflege im Studio Silke in Ziesendorf, mit Termin." },
  { slug: "eis-mango-frankfurt", name: "Eis Mango", kurz: "Eis Mango", t: "eis", label: "Eisdiele", street: "Alt-Schwanheim 41", plz: "60529", ort: "Frankfurt am Main", phone: "069 66389237",
    hours: [["Montag bis Sonntag", "10:00 bis 21:00"]],
    layout: "rund", svc: "gross", r: "999px", c: { bg: "#FFF3D6", ink: "#3D1F00", acc: "#FF9F1C", on: "#3D1F00", acc2: "#FF4F79" }, f: { d: "Bagel Fat One", b: "Rubik", gf: "Bagel+Fat+One&family=Rubik:wght@400;600", dw: 400 },
    headline: "Jeden Tag Eis, von zehn bis neun.", lead: "Eis Mango in Alt-Schwanheim, Frankfurt." },
  { slug: "kfz-schornberg-koenigswinter", name: "Kfz-Meisterbetrieb Schornberg", kurz: "Schornberg", t: "kfz", label: "Kfz-Meisterbetrieb", owner: "Inhaber Uwe Schornberg", street: "Kaiserstraße 2", plz: "53639", ort: "Königswinter", phone: "02223 909550",
    layout: "spalte", svc: "liste", r: "0", c: { bg: "#F2F4F5", ink: "#101820", acc: "#0057B8", on: "#FFFFFF", acc2: "#FFD100" }, f: { d: "Big Shoulders Display", b: "Chivo", gf: "Big+Shoulders+Display:wght@700;900&family=Chivo:wght@400;600", dw: 900 },
    headline: "Reparatur und Service für alle Marken.", lead: "Kfz-Meisterbetrieb Uwe Schornberg in der Kaiserstraße in Königswinter." },
  { slug: "stillger-raumausstattung-diez", name: "Stillger Raumausstattung + Autosattlerei", kurz: "Stillger", t: "raum", label: "Raumausstattung und Autosattlerei", ort: "Diez",
    hours: [["Montag bis Freitag", "9:00 bis 17:00"], ["Samstag und Sonntag", "geschlossen"]],
    layout: "massband", svc: "gross", r: ".2rem", c: { bg: "#20302F", ink: "#F0E7D8", acc: "#D08C47", on: "#20302F", acc2: "#3D5957" }, f: { d: "Syne", b: "Onest", gf: "Syne:wght@600;800&family=Onest:wght@400;600", dw: 800 },
    headline: "Neu bezogen statt neu gekauft.", lead: "Stillger in Diez verbindet Raumausstattung und Autosattlerei." },
  { slug: "beauty-nails-and-more-wurzbach", name: "Beauty Nails and More", kurz: "Beauty Nails", t: "nails", label: "Nagelstudio", street: "Leutenberger Straße 18", plz: "07343", ort: "Wurzbach",
    layout: "fenster", svc: "gross", r: "999px", c: { bg: "#FFE8EC", ink: "#3A0F2B", acc: "#C2187A", on: "#FFFFFF", acc2: "#7DE2D1" }, f: { d: "Unbounded", b: "Outfit", gf: "Unbounded:wght@500;700&family=Outfit:wght@300;500", dw: 700 },
    headline: "Nägel, die zu Ihnen passen.", lead: "Beauty Nails and More in der Leutenberger Straße in Wurzbach." },
  { slug: "metzgerei-weber-helmbrechts", name: "Metzgerei Weber", kurz: "Weber", t: "metzger", label: "Metzgerei", street: "Friedrich-Ebert-Str. 11", plz: "95233", ort: "Helmbrechts", phone: "09252 204",
    layout: "zettel", svc: "spalten", r: "0", c: { bg: "#FFFDF7", ink: "#23201D", acc: "#A4161A", on: "#FFFFFF", acc2: "#264653" }, f: { d: "Abril Fatface", b: "Work Sans", gf: "Abril+Fatface&family=Work+Sans:wght@400;600", dw: 400 },
    headline: "Wurst und Fleisch aus Helmbrechts.", lead: "Metzgerei Weber in der Friedrich-Ebert-Straße. Bestellungen nehmen wir am Telefon an." },
  { slug: "metzgerei-ohnemueller-kulmbach", name: "Metzgerei & Gaststätte Ohnemüller", kurz: "Ohnemüller", t: "metzger", label: "Metzgerei und Gaststätte", street: "Hans-Meiser-Str. 13", plz: "95326", ort: "Kulmbach", phone: "09221 74850",
    layout: "plakat", svc: "liste", r: ".2rem", c: { bg: "#F3EAD3", ink: "#2B1D12", acc: "#7A1F1F", on: "#F3EAD3", acc2: "#C99A2E" }, f: { d: "Yeseva One", b: "Alegreya Sans", gf: "Yeseva+One&family=Alegreya+Sans:wght@400;700", dw: 400 },
    headline: "Metzgerei und Gaststätte in einem Haus.", lead: "Einkaufen an der Theke oder gleich zum Essen bleiben, in der Hans-Meiser-Straße in Kulmbach.",
    services: [["Metzgerei", "Fleisch, Wurst und Aufschnitt aus der Theke."], ["Gaststätte", "Fränkische Küche zum Hinsetzen."], ["Für Grill und Pfanne", "Bratwürste, Steaks und Mariniertes in der Saison."], ["Platten auf Bestellung", "Für Feiern und Feste, nach telefonischer Absprache."]] },
  { slug: "anjas-blumenladen-hille", name: "Anja's Blumenladen", kurz: "Anja's Blumenladen", t: "blumen", label: "Blumenladen", owner: "Inhaberin Anja Becker", street: "Mindener Str. 75", plz: "32479", ort: "Hille", phone: "05703 517946",
    layout: "schild", svc: "liste", r: "1rem", c: { bg: "#FFF9EC", ink: "#2D3A1F", acc: "#E0701A", on: "#FFFFFF", acc2: "#5B8C3A" }, f: { d: "Lilita One", b: "Karla", gf: "Lilita+One&family=Karla:wght@400;600", dw: 400 },
    headline: "Blumen von Anja.", lead: "Sträuße, Pflanzen und Gestecke in der Mindener Straße in Hille." },
  { slug: "blumenhaus-gerkensmeier-loehne", name: "Blumenhaus Gerkensmeier", kurz: "Gerkensmeier", t: "blumen", label: "Blumenhaus", street: "Vogelstraße 19", ort: "Löhne",
    layout: "spalte", svc: "spalten", r: ".8rem", c: { bg: "#F0EEF6", ink: "#231942", acc: "#5E548E", on: "#FFFFFF", acc2: "#E0B1CB" }, f: { d: "Marcellus", b: "Manrope", gf: "Marcellus&family=Manrope:wght@400;600", dw: 400 },
    headline: "Blumen aus Löhne.", lead: "Das Blumenhaus Gerkensmeier in der Vogelstraße bindet Sträuße für jeden Anlass." },
  { slug: "kfz-hassmer-frankfurt", name: "Kfz-Meisterbetrieb Hassmer", kurz: "Hassmer", t: "kfz", label: "Kfz-Meisterbetrieb", owner: "Inhaber Oliver Hassmer", street: "Hoechster-Farben-Straße 2", plz: "65931", ort: "Frankfurt am Main", phone: "069 370010",
    layout: "plakat", svc: "spalten", r: "0", c: { bg: "#ECEFF1", ink: "#1C1F24", acc: "#D62839", on: "#FFFFFF", acc2: "#1C1F24" }, f: { d: "Anton", b: "Archivo", gf: "Anton&family=Archivo:wght@400;600", dw: 400 },
    headline: "Inspektion, Reparatur, fertig.", lead: "Der Kfz-Meisterbetrieb von Oliver Hassmer in der Hoechster-Farben-Straße in Frankfurt am Main." },
  { slug: "la-verde-eis-hanau", name: "La Verde Eis", kurz: "La Verde", t: "eis", label: "Eisdiele", street: "Ludwigstr. 120", plz: "63456", ort: "Hanau-Steinheim",
    hours: [["Montag bis Freitag", "13:00 bis 21:30"], ["Samstag und Sonntag", "12:30 bis 21:30"]],
    layout: "fenster", svc: "liste", r: "999px", c: { bg: "#EEF5DB", ink: "#24361C", acc: "#4F8A3C", on: "#FFFFFF", acc2: "#F7B2BD" }, f: { d: "Instrument Serif", b: "Schibsted Grotesk", gf: "Instrument+Serif:ital@0;1&family=Schibsted+Grotesk:wght@400;600", dw: 400 },
    headline: "Eis in Steinheim, täglich bis halb zehn.", lead: "La Verde Eis in der Ludwigstraße in Hanau." },
  { slug: "uhrenrestauration-heyne-moenchengladbach", name: "Uhrenrestauration Romy Heyne", kurz: "Romy Heyne", t: "uhr", label: "Uhrmacherin", ort: "Mönchengladbach",
    hours: [["Alle Tage", "Termine nur nach Vereinbarung"]],
    layout: "rund", svc: "liste", r: "0", c: { bg: "#10192B", ink: "#E9E2D0", acc: "#C9A24B", on: "#10192B", acc2: "#24324D" }, f: { d: "Newsreader", b: "Familjen Grotesk", gf: "Newsreader:opsz,wght@6..72,400;6..72,600&family=Familjen+Grotesk:wght@400;600", dw: 400 },
    headline: "Alte Uhren wieder zum Laufen bringen.", lead: "Uhrmacherin Romy Heyne restauriert und repariert historische und antike Uhren in Mönchengladbach." },
  { slug: "hairstyling-kullmann-leinefelde-worbis", name: "Hairstyling Kullmann", kurz: "Kullmann", t: "friseur", label: "Friseur", owner: "Silke Kullmann", street: "Beethovenstraße 13", plz: "37327", ort: "Leinefelde-Worbis", phone: "03605 510007",
    layout: "spalte", svc: "gross", r: "999px", c: { bg: "#FFF4E9", ink: "#20130E", acc: "#E8472B", on: "#FFFFFF", acc2: "#1F7A8C" }, f: { d: "Red Hat Display", b: "Red Hat Text", gf: "Red+Hat+Display:wght@700;900&family=Red+Hat+Text:wght@400;600", dw: 900 },
    headline: "Ein Termin, ein guter Schnitt.", lead: "Hairstyling Kullmann in Leinefelde-Worbis." },
  { slug: "aenderungsschneiderei-zakel-ludwigshafen", name: "Änderungsschneiderei Zakel", kurz: "Zakel", t: "schneider", label: "Änderungsschneiderei", ort: "Ludwigshafen am Rhein", phone: "0621 6719955",
    layout: "schild", svc: "spalten", r: ".2rem", c: { bg: "#F4F6F1", ink: "#2B2D42", acc: "#3A5A40", on: "#FFFFFF", acc2: "#DDA15E" }, f: { d: "Literata", b: "Epilogue", gf: "Literata:opsz,wght@7..72,600;7..72,800&family=Epilogue:wght@400;600", dw: 800 },
    headline: "Ändern, kürzen, anpassen.", lead: "Änderungsschneiderei Zakel in Ludwigshafen." },
  { slug: "imkerei-hensel-brakel", name: "Imkerei Hensel", kurz: "Imkerei Hensel", t: "imker", label: "Imkerei", ort: "Brakel",
    layout: "rund", svc: "gross", r: ".4rem", c: { bg: "#FFF7DA", ink: "#2B1B00", acc: "#F2A900", on: "#2B1B00", acc2: "#5A3E1B" }, f: { d: "Spectral", b: "Karla", gf: "Spectral:wght@600;800&family=Karla:wght@400;600", dw: 800 },
    headline: "Honig aus Brakel.", lead: "Die Imkerei Hensel verkauft Honig direkt vom Imker." },
  { slug: "blatt-und-bluete-loehne", name: "Blatt & Blüte", kurz: "Blatt & Blüte", t: "blumen", label: "Blumenladen", owner: "Silke Hanke-Karneil", ort: "Löhne",
    layout: "tafel", svc: "spalten", r: ".6rem", c: { bg: "#F1F5E9", ink: "#14342B", acc: "#B85C1E", on: "#FFFFFF", acc2: "#F4A259", board: "#14342B", chalk: "#F1F5E9" }, f: { d: "Gochi Hand", b: "Lora", gf: "Gochi+Hand&family=Lora:wght@400;600", dw: 400 },
    headline: "Blatt für Blatt gebunden.", lead: "Blatt & Blüte von Silke Hanke-Karneil in Löhne." },
  { slug: "fusspflege-opalka-schwaan", name: "Medizinische Fußpflege Sabine Opalka", kurz: "Sabine Opalka", t: "fusspflege", label: "Medizinische Fußpflege", ort: "Schwaan",
    layout: "schild", svc: "liste", r: ".8rem", c: { bg: "#F0F7FA", ink: "#12343B", acc: "#2D6E7E", on: "#FFFFFF", acc2: "#E1B07E" }, f: { d: "Lora", b: "Hanken Grotesk", gf: "Lora:wght@500;700&family=Hanken+Grotesk:wght@400;600", dw: 700 },
    headline: "Medizinische Fußpflege in Schwaan.", lead: "Sabine Opalka behandelt nach Terminabsprache." },
];

/* ---------- Bausteine ---------- */
const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const tel = (p) => `tel:+49${p.replace(/\D/g, "").replace(/^0/, "")}`;
const adresse = (s) => [s.street, [s.plz, s.ort].filter(Boolean).join(" ")].filter(Boolean);
const maps = (s) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([s.name, ...adresse(s)].join(", "))}`;
const vollstaendig = (s) => Boolean(s.street && s.phone);

function cta(s, zweite = true) {
  const a = s.phone
    ? `<a class="btn" href="${tel(s.phone)}">Anrufen: ${esc(s.phone)}</a>`
    : s.street
      ? `<a class="btn" href="${maps(s)}" rel="noopener">Route in Google Maps öffnen</a>`
      : "";
  const b = zweite ? `<a class="btn ghost" href="#besuch">${s.hours ? "Öffnungszeiten ansehen" : "So finden Sie uns"}</a>` : "";
  return `<p class="cta">${a}${b}</p>`;
}

function zeiten(s) {
  if (s.hours) return `<table class="zeit"><tbody>${s.hours.map(([d, z]) => `<tr><th scope="row">${esc(d)}</th><td>${esc(z)}</td></tr>`).join("")}</tbody></table>`;
  return `<p>${s.phone ? "Die aktuellen Öffnungszeiten erfahren Sie am Telefon." : "Die Öffnungszeiten werden hier ergänzt."}</p>`;
}

function kontakt(s) {
  const a = adresse(s);
  return `<address>${esc(s.name)}<br>${a.map(esc).join("<br>")}</address>
  ${s.owner ? `<p>${esc(s.owner)}</p>` : ""}
  ${s.phone ? `<p class="gross-tel"><a href="${tel(s.phone)}">${esc(s.phone)}</a></p>` : `<p>Die Telefonnummer wird hier ergänzt.</p>`}
  ${s.street ? `<p><a class="btn ghost" href="${maps(s)}" rel="noopener">Route in Google Maps öffnen</a></p>` : `<p>Die genaue Anschrift wird hier ergänzt.</p>`}`;
}

const HERO = {
  plakat: (s) => `<section class="hero plakat"><div class="wrap">
    <p class="meta">${esc(s.label)} in ${esc(s.ort)}${s.street ? `<br>${esc(s.street)}` : ""}</p>
    <h1>${esc(s.kurz)}</h1>
    <div class="zeile"><p class="lead"><strong>${esc(s.headline)}</strong> ${esc(s.lead)}</p>${cta(s)}</div>
  </div></section>`,
  massband: (s) => `<section class="hero massband"><div class="band" aria-hidden="true"></div><div class="wrap raster">
    <div><h1>${esc(s.headline)}</h1><p class="lead">${esc(s.lead)}</p>${cta(s)}</div>
    ${svg(s.t)}
  </div><div class="wrap"><div class="naht" aria-hidden="true"></div></div></section>`,
  fenster: (s) => `<section class="hero fenster"><div class="wrap raster">
    <div><h1>${esc(s.headline)}</h1><p class="lead">${esc(s.lead)}</p>${cta(s)}</div>
    <div class="bogen" aria-hidden="true"><span class="punkt"></span>${svg(s.t)}</div>
  </div></section>`,
  schild: (s) => `<section class="hero schild${s.kachel ? " kachel" : ""}"><div class="wrap">
    <div class="tafel-schild"><p class="klein">${esc(s.label)} in ${esc(s.ort)}</p><h1>${esc(s.kurz)}</h1></div>
    <p class="satz">${esc(s.headline)}</p><p class="lead">${esc(s.lead)}</p>${cta(s)}
  </div></section>`,
  zettel: (s) => `<section class="hero zettel"><div class="wrap raster">
    <div><h1>${esc(s.headline)}</h1><p class="lead">${esc(s.lead)}</p>${cta(s, false)}</div>
    <div class="bon-h"><aside class="bon"><h2>${s.hours ? "Geöffnet" : "Bestellen und abholen"}</h2>${s.hours ? zeiten(s) : `<p>${adresse(s).map(esc).join("<br>")}</p>${s.phone ? `<p class="gross-tel"><a href="${tel(s.phone)}">${esc(s.phone)}</a></p>` : ""}`}${svg(s.t, "klein")}</aside></div>
  </div></section>`,
  tafel: (s) => `<section class="hero tafel"><div class="wrap"><div class="rahmen">
    <h1>${esc(s.headline)}</h1>
    <ul>${(s.services || LEISTUNGEN[s.t]).map(([t]) => `<li>${esc(t)}</li>`).join("")}</ul>
    <p class="lead">${esc(s.lead)}</p>${cta(s)}
  </div></div></section>`,
  spalte: (s) => `<section class="hero spalte"><div class="streifen" aria-hidden="true"><span>${esc(s.kurz)}</span></div><div class="inhalt">
    <h1>${esc(s.headline)}</h1><p class="lead">${esc(s.lead)}</p>${cta(s)}${svg(s.t)}
  </div></section>`,
  rund: (s) => `<section class="hero rund"><div class="wrap raster">
    <div><h1>${esc(s.headline)}</h1><p class="lead">${esc(s.lead)}</p>${cta(s)}</div>
    <div class="kreis" aria-hidden="true"><span class="punkt"></span>${svg(s.t)}</div>
  </div></section>`,
};

const LEISTUNG = {
  liste: (L) => `<dl class="liste">${L.map(([t, d]) => `<div><dt>${esc(t)}</dt><dd>${esc(d)}</dd></div>`).join("")}</dl>`,
  spalten: (L) => `<ul class="spalten">${L.map(([t, d]) => `<li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join("")}</ul>`,
  gross: (L) => `<ul class="gross">${L.map(([t, d]) => `<li><h3>${esc(t)}</h3><p>${esc(d)}</p></li>`).join("")}</ul>`,
};

const CSS = `
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%;scroll-behavior:smooth}
body{margin:0;background:var(--bg);color:var(--ink);font:400 1.0625rem/1.6 var(--body);overflow-x:hidden}
h1,h2,h3{font-family:var(--display);font-weight:var(--dw);line-height:1.04;margin:0;text-wrap:balance}
p{margin:0 0 1rem;max-width:62ch}a{color:inherit;text-underline-offset:.18em}
:focus-visible{outline:3px solid var(--acc2);outline-offset:3px}
.wrap{max-width:72rem;margin-inline:auto;padding-inline:clamp(1.1rem,4vw,2.5rem)}
.entwurf{background:var(--ink);color:var(--bg);font-size:.8125rem;padding:.45rem 1rem;text-align:center;margin:0;max-width:none}
.kopf{display:flex;justify-content:space-between;align-items:baseline;gap:1rem;padding-block:1.1rem;flex-wrap:wrap}
.kopf .n{font-family:var(--display);font-weight:var(--dw);font-size:1.25rem;text-decoration:none;overflow-wrap:anywhere;min-width:0}
.kopf nav{display:flex;gap:1.4rem;font-size:.95rem}
.btn{display:inline-block;background:var(--acc);color:var(--on);padding:.85rem 1.4rem;border-radius:var(--r);text-decoration:none;font-weight:600;line-height:1.2}
.btn:hover{filter:brightness(.92)}
.btn.ghost{background:transparent;color:inherit;box-shadow:inset 0 0 0 2px currentColor}
.btn.ghost:hover{background:color-mix(in srgb,currentColor 12%,transparent);filter:none}
.cta{display:flex;flex-wrap:wrap;gap:.75rem;margin:1.75rem 0 0;max-width:none}
.lead{font-size:clamp(1.1rem,1.6vw,1.3rem);line-height:1.5;max-width:46ch}
.motiv{width:100%;height:auto;display:block}
.hero h1{font-size:clamp(2.1rem,6vw,4.75rem);margin-bottom:1.25rem;overflow-wrap:break-word;hyphens:auto}.raster>*{min-width:0}
.raster{display:grid;grid-template-columns:1.15fr .85fr;gap:clamp(1.5rem,5vw,4rem);align-items:center}
.hero{padding-block:clamp(2rem,6vw,5rem)}

.plakat{background:var(--acc);color:var(--on);padding-block:clamp(1.5rem,4vw,3rem) clamp(2rem,5vw,3.5rem)}
.plakat .meta{text-align:right;margin-left:auto;font-size:.95rem;line-height:1.4}
.plakat h1{font-size:clamp(3.4rem,15vw,12.5rem);line-height:.86;letter-spacing:-.02em;margin:clamp(2.5rem,9vw,7rem) 0 clamp(1.5rem,3vw,2.5rem);font-size:min(12.5rem,calc(min(67rem,100vw - 2.4rem)/(var(--n)*.6)))}
.plakat .zeile{display:flex;flex-wrap:wrap;gap:1.5rem 3rem;align-items:end;justify-content:space-between;border-top:2px solid currentColor;padding-top:1.5rem}
.plakat .lead{margin:0}.plakat .cta{margin:0}
.plakat .btn{background:var(--on);color:var(--acc)}.plakat .btn.ghost{background:transparent;color:inherit}

.massband{padding-top:0}
.band{height:3.25rem;background:var(--acc2);background-image:repeating-linear-gradient(90deg,var(--ink) 0 2px,transparent 2px 5rem),repeating-linear-gradient(90deg,var(--ink) 0 1px,transparent 1px 1rem);background-size:auto 100%,auto 45%;background-repeat:repeat-x;background-position:0 0,0 100%;margin-bottom:clamp(2rem,6vw,4.5rem)}
.massband .motiv{max-width:18rem;justify-self:end;color:var(--acc)}
.naht{border-top:3px dashed var(--acc);margin-top:clamp(2rem,5vw,4rem)}

.bogen{position:relative;background:var(--acc2);color:var(--ink);border-radius:999px 999px 0 0;aspect-ratio:3/4;max-width:24rem;width:100%;justify-self:end;display:grid;place-items:center;padding:14%}
.bogen .punkt,.kreis .punkt{position:absolute;width:26%;aspect-ratio:1;border-radius:50%;background:var(--acc);left:-9%;bottom:12%}

.schild{text-align:center;border-top:6px solid var(--ink);padding-top:0}
.schild.kachel{background-image:linear-gradient(var(--acc2) 2px,transparent 2px),linear-gradient(90deg,var(--acc2) 2px,transparent 2px);background-size:4.5rem 4.5rem}
.tafel-schild{display:inline-block;position:relative;margin-top:3.5rem;border:4px solid var(--ink);background:var(--bg);padding:clamp(1.2rem,3vw,2rem) clamp(1.5rem,5vw,3.5rem);border-radius:var(--r);box-shadow:.6rem .6rem 0 var(--acc)}
.tafel-schild::before,.tafel-schild::after{content:"";position:absolute;top:calc(-3.5rem - 4px);height:3.5rem;width:4px;background:var(--ink)}
.tafel-schild::before{left:18%}.tafel-schild::after{right:18%}
.tafel-schild h1{font-size:min(clamp(2.2rem,8vw,5.5rem),calc((100vw - 7rem)/(var(--n)*.56)));margin:0}
.klein{font-size:.95rem;margin:0 0 .4rem;max-width:none}
.schild .satz{font-family:var(--display);font-weight:var(--dw);font-size:clamp(1.5rem,3.4vw,2.4rem);line-height:1.15;margin:clamp(2.5rem,5vw,3.5rem) auto .75rem}
.schild .lead{margin-inline:auto}.schild .cta{justify-content:center}

.bon-h{filter:drop-shadow(0 .5rem 1rem rgb(0 0 0/.22));max-width:23rem;justify-self:end;width:100%}.bon{background:#FFFDF8;color:#231F1C;padding:1.6rem 1.5rem 2.6rem;transform:rotate(-2deg);
 -webkit-mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/1rem 100%;mask:conic-gradient(from -45deg at bottom,#0000,#000 1deg 89deg,#0000 90deg) 50%/1rem 100%}
.bon h2{font-size:1.6rem;margin-bottom:.9rem;padding-bottom:.7rem;border-bottom:2px dashed currentColor}
.bon .zeit th,.bon .zeit td{border-color:#231F1C33;font-size:.95rem}
.bon .motiv.klein{width:3.5rem;margin:1rem 0 0 auto}

.tafel{background:var(--board);color:var(--chalk)}
.rahmen{border:2px solid color-mix(in srgb,var(--chalk) 55%,transparent);border-radius:6px;padding:clamp(1.5rem,5vw,3.5rem)}
.tafel h1{font-size:clamp(2.6rem,8vw,6rem)}
.tafel ul{list-style:none;padding:0;margin:0 0 1.75rem;font-family:var(--display);font-size:clamp(1.3rem,2.6vw,1.9rem);line-height:1.5;color:var(--acc2);columns:2;column-gap:3rem;max-width:40rem}.tafel li{break-inside:avoid}
.tafel .btn{background:var(--acc2);color:var(--board)}.tafel .btn.ghost{background:transparent;color:inherit}

.spalte{display:grid;grid-template-columns:clamp(4rem,13vw,9.5rem) 1fr;padding:0;min-height:min(78vh,44rem)}
.streifen{background:var(--acc);color:var(--on);display:grid;place-items:center;overflow:hidden}
.streifen span{writing-mode:vertical-rl;transform:rotate(180deg);font-family:var(--display);font-weight:var(--dw);font-size:min(clamp(2.2rem,8vw,6.5rem),calc(38rem/(var(--n)*.58)));line-height:1;white-space:nowrap}
.spalte .inhalt{padding:clamp(2rem,7vw,6rem) clamp(1.25rem,6vw,5rem);position:relative;display:flex;flex-direction:column;justify-content:center}
.spalte .motiv{position:absolute;right:clamp(1rem,4vw,3rem);bottom:clamp(1rem,3vw,2rem);width:clamp(5rem,14vw,10rem);color:var(--acc2)}

.rund{overflow:hidden}
.kreis{position:relative;background:var(--acc);color:var(--on);border-radius:50%;aspect-ratio:1;width:min(30rem,100%);justify-self:end;display:grid;place-items:center;padding:20%;transform:translateX(8%)}
.kreis .punkt{background:var(--acc2);left:-4%;bottom:4%}

section.teil{padding-block:clamp(3rem,8vw,6rem)}
.teil h2{font-size:clamp(1.9rem,4.4vw,3.2rem);margin-bottom:clamp(1.5rem,3vw,2.5rem)}
.liste{margin:0}.liste div{display:grid;grid-template-columns:minmax(12rem,1fr) 2fr;gap:.25rem 2rem;padding:1.1rem 0;border-top:1px solid color-mix(in srgb,var(--ink) 25%,transparent)}
.liste div:last-child{border-bottom:1px solid color-mix(in srgb,var(--ink) 25%,transparent)}
.liste dt{font-family:var(--display);font-weight:var(--dw);font-size:1.35rem;line-height:1.2}.liste dd{margin:0}
.spalten{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(13.5rem,1fr));gap:2rem}
.spalten li{border-top:5px solid var(--acc);padding-top:1rem}.spalten h3{font-size:1.4rem;margin-bottom:.5rem}.spalten p{margin:0}
.gross{list-style:none;padding:0;margin:0}
.gross li{display:grid;grid-template-columns:1.2fr 1fr;gap:.5rem 2.5rem;align-items:baseline;margin-bottom:1.25rem}
.gross li>*{min-width:0}.gross h3{font-size:clamp(1.5rem,4.6vw,3.4rem);color:color-mix(in srgb,var(--acc) 72%,var(--ink));overflow-wrap:anywhere;hyphens:auto}.gross p{margin:0}
#besuch{background:color-mix(in srgb,var(--ink) 7%,var(--bg))}
.zwei{display:grid;grid-template-columns:1fr 1fr;gap:clamp(2rem,6vw,5rem)}
.zwei h3{font-size:1.4rem;margin-bottom:1rem}
.zeit{border-collapse:collapse;width:100%}.zeit th,.zeit td{text-align:left;padding:.6rem 0;border-bottom:1px solid color-mix(in srgb,var(--ink) 22%,transparent);vertical-align:top;font-weight:400}
.zeit th{padding-right:1.5rem;font-weight:600;white-space:nowrap}
address{font-style:normal;margin-bottom:1rem}
.gross-tel{font-family:var(--display);font-weight:var(--dw);font-size:clamp(1.8rem,4vw,2.6rem);line-height:1.1;margin:.5rem 0 1.25rem}.gross-tel a{text-decoration:none}
.fuss{padding-block:2rem;font-size:.9rem;display:flex;flex-wrap:wrap;gap:.5rem 2rem;justify-content:space-between}
.fuss p{margin:0}
@media (max-width:760px){
 .raster,.zwei{grid-template-columns:1fr}.kopf nav{display:none}
 .bogen,.kreis,.bon-h,.massband .motiv{justify-self:start}.bogen{max-width:15rem}.kreis{width:min(17rem,80%);transform:none}.massband .motiv{max-width:9rem}
 .liste div,.gross li{grid-template-columns:1fr}.tafel ul{columns:1}
 .zeit th{white-space:normal}.plakat .meta{text-align:left;margin-left:0}
 .spalte .motiv{position:static;margin-top:2rem}
}
@media (prefers-reduced-motion:reduce){html{scroll-behavior:auto}}
`;

function seite(s) {
  const L = s.services || LEISTUNGEN[s.t];
  const a = adresse(s);
  const ld = { "@context": "https://schema.org", "@type": "LocalBusiness", name: s.name };
  if (s.phone) ld.telephone = `+49${s.phone.replace(/\D/g, "").replace(/^0/, "")}`;
  if (s.street) ld.address = { "@type": "PostalAddress", streetAddress: s.street, postalCode: s.plz, addressLocality: s.ort, addressCountry: "DE" };
  const v = s.c;
  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(s.name)} in ${esc(s.ort)}</title>
<meta name="description" content="${esc(`${s.headline} ${s.lead}`)}">
<meta name="robots" content="noindex">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=${s.f.gf}&display=swap" rel="stylesheet">
<style>
:root{--bg:${v.bg};--ink:${v.ink};--acc:${v.acc};--on:${v.on};--acc2:${v.acc2};--board:${v.board || v.ink};--chalk:${v.chalk || v.bg};--r:${s.r};--display:"${s.f.d}",Georgia,serif;--body:"${s.f.b}",system-ui,sans-serif;--dw:${s.f.dw};--n:${s.kurz.length}}
${CSS}</style>
<script type="application/ld+json">${JSON.stringify(ld)}</script>
</head>
<body>
<p class="entwurf">Entwurf, noch nicht veröffentlicht. Alle Angaben vor dem Start mit dem Betrieb abstimmen.</p>
<header class="wrap kopf">
  <a class="n" href="#">${esc(s.name)}</a>
  <nav aria-label="Seite"><a href="#leistungen">Angebot</a><a href="#besuch">Öffnungszeiten und Kontakt</a></nav>
</header>
<main>
${HERO[s.layout](s)}
<section class="teil" id="leistungen"><div class="wrap">
  <h2>Was Sie bei uns bekommen</h2>
  ${LEISTUNG[s.svc](L)}
</div></section>
<section class="teil" id="besuch"><div class="wrap">
  <h2>${s.street ? "Kommen Sie vorbei" : "So erreichen Sie uns"}</h2>
  <div class="zwei">
    <div><h3>Öffnungszeiten</h3>${zeiten(s)}</div>
    <div><h3>Kontakt</h3>${kontakt(s)}</div>
  </div>
</div></section>
</main>
<footer class="wrap fuss">
  <p>${esc(s.name)}${a.length ? `, ${a.map(esc).join(", ")}` : ""}</p>
  <p>Impressum und Datenschutzerklärung werden vor der Veröffentlichung ergänzt.</p>
</footer>
</body>
</html>
`;
}

/* ---------- Ausgabe ---------- */
for (const s of SITES) {
  const dir = join(OUT, s.slug);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "index.html"), seite(s));
}

const zeilen = SITES.map((s, i) => `<tr><td>${i + 1}</td><td><a href="./${s.slug}/index.html">${esc(s.name)}</a></td><td>${esc(s.label)}</td><td>${esc(s.ort)}</td><td>${esc(s.phone || "fehlt")}</td><td>${vollstaendig(s) ? "Anschrift und Telefon vorhanden" : "Kontaktdaten unvollständig"}</td></tr>`).join("\n");
writeFileSync(join(OUT, "index.html"), `<!doctype html>
<html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>30 Webseiten-Entwürfe</title><meta name="robots" content="noindex">
<style>body{font:1rem/1.55 system-ui,sans-serif;margin:0;padding:clamp(1rem,4vw,3rem);color:#1c2430;background:#f6f8fa}h1{font-size:clamp(1.8rem,4vw,2.6rem);margin:0 0 .5rem}p{max-width:70ch}
.t{overflow-x:auto}table{border-collapse:collapse;width:100%;min-width:44rem;background:#fff}th,td{text-align:left;padding:.6rem .8rem;border-bottom:1px solid #d9e0e7}th{background:#e9eef3}a{color:#0b57a4}</style></head>
<body><h1>30 Webseiten-Entwürfe</h1>
<p>Entwürfe für Betriebe in Deutschland, für die bei der Recherche in öffentlichen Branchenverzeichnissen und per Websuche keine eigene Webseite auffindbar war. Stammdaten stammen aus diesen Verzeichnissen und müssen vor einer Veröffentlichung mit dem jeweiligen Betrieb abgestimmt werden.</p>
<div class="t"><table><thead><tr><th>Nr.</th><th>Betrieb</th><th>Branche</th><th>Ort</th><th>Telefon</th><th>Datenstand</th></tr></thead><tbody>
${zeilen}
</tbody></table></div></body></html>
`);
console.log(`${SITES.length} Seiten geschrieben nach ${OUT}`);
