/**
 * Contact Page
 * Server component wrapper with metadata
 */

import { Metadata } from "next";
import { ContactPageClient } from "./contact-client";

export const metadata: Metadata = {
  title: "Contact Us",
  description: "Get in touch with the Koya team. We're here to answer your questions about our AI phone receptionist service.",
  openGraph: {
    title: "Contact Us | Koya Caller",
    description: "Have questions about Koya? We're here to help. Reach out and we'll get back to you as soon as possible.",
  },
};

export default function ContactPage() {
  return <ContactPageClient />;
}
