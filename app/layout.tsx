import type { Metadata, Viewport } from "next";
import { Footer } from "@/components/Footer";
import { Header } from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Werkstatt-Check – Kostenvoranschlag verständlich prüfen",
  description:
    "Foto vom Kostenvoranschlag oder der Werkstattrechnung hochladen und eine verständliche Einschätzung erhalten: Positionen, Dringlichkeit, Preis-Plausibilität und Fragen an die Werkstatt.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1e40af",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body className="flex min-h-screen flex-col font-sans antialiased">
        <Header />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
