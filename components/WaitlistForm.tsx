"use client";

import Link from "next/link";
import { useState } from "react";

type Status = "idle" | "sending" | "done" | "error";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [website, setWebsite] = useState(""); // Honigtopf gegen Bots
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const response = await fetch("/api/warteliste", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, website }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Unbekannter Fehler");
      setStatus("done");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Unbekannter Fehler");
    }
  }

  if (status === "done") {
    return (
      <div className="rounded-xl border border-ok-700/30 bg-ok-50 p-4 text-slate-800">
        <p className="font-semibold text-ok-700">Fast geschafft!</p>
        <p className="mt-1 text-sm">
          Wir haben dir eine E-Mail geschickt. Bitte klicke auf den Bestätigungslink darin – erst
          dann stehst du auf der Warteliste.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex flex-col gap-2 sm:flex-row">
        <label htmlFor="waitlist-email" className="sr-only">
          E-Mail-Adresse
        </label>
        <input
          id="waitlist-email"
          type="email"
          required
          autoComplete="email"
          placeholder="deine@email.de"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="min-h-12 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-100"
        />
        {/* Unsichtbares Feld: Bots füllen es aus, Menschen nicht. */}
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(e) => setWebsite(e.target.value)}
          className="hidden"
          aria-hidden
        />
        <button
          type="submit"
          disabled={status === "sending"}
          className="min-h-12 rounded-lg bg-brand-700 px-5 font-semibold text-white hover:bg-brand-900 disabled:opacity-60"
        >
          {status === "sending" ? "Wird gesendet …" : "Auf die Warteliste"}
        </button>
      </div>
      {status === "error" && <p className="text-sm text-alert-700">{message}</p>}
      <p className="text-xs text-slate-500">
        Kein Spam. Du bekommst eine Bestätigungs-Mail und kannst dich jederzeit abmelden. Mehr dazu
        in der{" "}
        <Link href="/datenschutz" className="underline">
          Datenschutzerklärung
        </Link>
        .
      </p>
    </form>
  );
}
