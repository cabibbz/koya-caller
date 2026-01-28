/**
 * Phase 3: Test - Go Live
 * Server component wrapper with metadata
 */

import { Metadata } from "next";
import { TestPageClient } from "./test-client";

export const metadata: Metadata = {
  title: "Test Your AI Receptionist",
  description: "Make a test call to hear your AI receptionist in action before going live.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function TestPage() {
  return <TestPageClient />;
}
