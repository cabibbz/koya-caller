/**
 * Phase 2: Tune - Customize Koya
 * Server component wrapper with metadata
 */

import { Metadata } from "next";
import { TunePageClient } from "./tune-client";

export const metadata: Metadata = {
  title: "Customize Your AI Receptionist",
  description: "Review and adjust your AI receptionist's services, FAQs, and voice settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TunePage() {
  return <TunePageClient />;
}
