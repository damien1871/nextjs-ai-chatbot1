import type { Metadata } from "next";
import { DemoClient } from "./DemoClient";

export const metadata: Metadata = {
  title: "Demo – Werkstatt-Check",
  description: "Kostenvoranschlag oder Werkstattrechnung hochladen und verständlich einschätzen lassen.",
};

export default function DemoPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
      <DemoClient />
    </div>
  );
}
