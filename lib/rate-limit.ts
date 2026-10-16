/**
 * Einfacher Missbrauchsschutz: höchstens N Analysen pro IP-Adresse und Stunde.
 *
 * Die Zählung liegt nur im Arbeitsspeicher. Auf Vercel laufen manchmal mehrere
 * Server-Instanzen parallel, die jeweils eigen zählen – das Limit ist also
 * "ungefähr". Die harte Kostengrenze setzt du zusätzlich in der Anthropic-Konsole
 * (Monatsbudget). Für ein exaktes Limit könnte man später z. B. Upstash Redis nutzen.
 */

const WINDOW_MS = 60 * 60 * 1000; // 1 Stunde
const hits = new Map<string, number[]>();

export function checkRateLimit(ip: string): { allowed: boolean; retryAfterMinutes: number } {
  const limit = Number(process.env.RATE_LIMIT_PER_HOUR) || 5;
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= limit) {
    hits.set(ip, recent);
    const retryAfterMs = WINDOW_MS - (now - recent[0]);
    return { allowed: false, retryAfterMinutes: Math.ceil(retryAfterMs / 60000) };
  }

  recent.push(now);
  hits.set(ip, recent);

  // Alte Einträge gelegentlich aufräumen, damit der Speicher nicht wächst.
  if (hits.size > 5000) {
    for (const [key, times] of hits) {
      if (times.every((t) => now - t >= WINDOW_MS)) hits.delete(key);
    }
  }
  return { allowed: true, retryAfterMinutes: 0 };
}

export function getClientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unbekannt";
}
