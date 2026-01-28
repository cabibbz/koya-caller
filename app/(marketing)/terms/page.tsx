/**
 * Terms of Service Page
 */

import { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms and conditions for using Koya Caller AI phone receptionist service.",
};

export default function TermsOfServicePage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Koya
          </Link>
          <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
            Log In
          </Link>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <h1 className="text-4xl font-bold mb-2">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Koya Caller (&quot;Service&quot;), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              Koya Caller provides an AI-powered phone receptionist service that answers calls, schedules appointments, and handles customer inquiries on behalf of your business. The Service includes phone number provisioning, call handling, appointment scheduling, and related features.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. Account Registration</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>You must provide accurate and complete registration information</li>
              <li>You are responsible for maintaining the security of your account</li>
              <li>You must be at least 18 years old to use the Service</li>
              <li>One person or business may not maintain more than one account</li>
              <li>You are responsible for all activity that occurs under your account</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Acceptable Use</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              You agree NOT to use the Service to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Violate any applicable laws or regulations</li>
              <li>Make or receive calls for illegal purposes</li>
              <li>Harass, abuse, or harm others</li>
              <li>Send spam or unsolicited communications</li>
              <li>Impersonate any person or entity</li>
              <li>Interfere with the proper functioning of the Service</li>
              <li>Attempt to gain unauthorized access to any systems</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Billing and Payments</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Subscription fees are billed in advance on a monthly or annual basis</li>
              <li>Usage beyond your plan&apos;s included minutes is billed at the overage rate</li>
              <li>All fees are non-refundable except as required by law</li>
              <li>You authorize us to charge your payment method for all fees</li>
              <li>Prices may change with 30 days notice</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Service Level</h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to maintain 99.9% uptime but do not guarantee uninterrupted service. The AI system makes its best effort to handle calls appropriately but may occasionally misunderstand or mishandle calls. We are not liable for any business losses resulting from AI errors or service interruptions.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Intellectual Property</h2>
            <p className="text-muted-foreground leading-relaxed">
              The Service, including all software, AI models, designs, and content, is owned by Koya Caller and protected by intellectual property laws. You retain ownership of your business data and content.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Data and Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              Your use of the Service is also governed by our <Link href="/privacy" className="text-primary hover:underline">Privacy Policy</Link>. You are responsible for obtaining any necessary consents from callers regarding call recording and data collection.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">9. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              You may cancel your account at any time. We may suspend or terminate your account for violation of these terms or for any other reason with notice. Upon termination, your right to use the Service ceases immediately.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">10. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed">
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, KOYA CALLER SHALL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS OR REVENUES, WHETHER INCURRED DIRECTLY OR INDIRECTLY. OUR TOTAL LIABILITY SHALL NOT EXCEED THE AMOUNT YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">11. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTY OF ANY KIND. WE DISCLAIM ALL WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, AND NON-INFRINGEMENT.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">12. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may modify these terms at any time. We will notify you of material changes via email or through the Service. Continued use after changes constitutes acceptance of the new terms.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">13. Governing Law</h2>
            <p className="text-muted-foreground leading-relaxed">
              These terms are governed by the laws of the State of California, without regard to conflict of law principles. Any disputes shall be resolved in the courts of San Francisco, California.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">14. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              Questions about these Terms should be sent to:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: <a href={`mailto:${APP_CONFIG.contact.legal}`} className="text-primary hover:underline">{APP_CONFIG.contact.legal}</a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Koya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
