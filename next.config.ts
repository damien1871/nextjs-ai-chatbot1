import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Der System-Prompt liegt als .md-Datei in lib/prompts und wird zur Laufzeit
  // gelesen. Diese Zeile sorgt dafür, dass Vercel die Datei mit hochlädt.
  outputFileTracingIncludes: {
    "/api/analyse": ["./lib/prompts/**/*"],
  },
};

export default nextConfig;
