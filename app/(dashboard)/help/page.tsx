/**
 * Help Center Page
 * Searchable FAQ and help articles
 */

import { Metadata } from "next";
import { HelpClient } from "./help-client";

export const metadata: Metadata = {
  title: "Help Center",
  description: "Get help with your Koya AI receptionist. Browse FAQs and help articles.",
};

export default function HelpPage() {
  return <HelpClient />;
}
