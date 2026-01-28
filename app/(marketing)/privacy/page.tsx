/**
 * Privacy Policy Page
 */

import { Metadata } from "next";
import Link from "next/link";
import { APP_CONFIG } from "@/lib/config";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Learn how Koya Caller collects, uses, and protects your personal information.",
};

export default function PrivacyPolicyPage() {
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
        <h1 className="text-4xl font-bold mb-2">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Last updated: {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>

        <div className="prose prose-gray dark:prose-invert max-w-none space-y-8">
          <section>
            <h2 className="text-2xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              Koya Caller (&quot;we,&quot; &quot;our,&quot; or &quot;us&quot;) is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our AI-powered phone receptionist service.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">2. Information We Collect</h2>
            <h3 className="text-lg font-medium mt-4 mb-2">Account Information</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Name and email address</li>
              <li>Business name and contact information</li>
              <li>Phone numbers</li>
              <li>Payment information (processed securely via Stripe)</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Call Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Phone call recordings (when enabled)</li>
              <li>Call transcripts and summaries</li>
              <li>Caller phone numbers</li>
              <li>Appointment and booking information</li>
            </ul>

            <h3 className="text-lg font-medium mt-4 mb-2">Usage Data</h3>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Service usage statistics</li>
              <li>Feature preferences and settings</li>
              <li>Device and browser information</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Provide and maintain our AI phone receptionist service</li>
              <li>Process appointments and bookings on your behalf</li>
              <li>Send notifications about calls, bookings, and account activity</li>
              <li>Improve our AI models and service quality</li>
              <li>Process payments and manage subscriptions</li>
              <li>Provide customer support</li>
              <li>Comply with legal obligations</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">4. Data Retention</h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your data for as long as your account is active or as needed to provide services. Call recordings are retained for 90 days unless you request earlier deletion. You can request deletion of your data at any time by contacting us.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">5. Data Sharing</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              We do not sell your personal information. We may share data with:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li><strong>Service Providers:</strong> Third parties that help us operate our service (hosting, payment processing, communication services)</li>
              <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
              <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">6. Security</h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement industry-standard security measures including encryption in transit and at rest, secure data centers, and regular security audits. However, no method of transmission over the Internet is 100% secure.
            </p>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">7. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Depending on your location, you may have the right to:
            </p>
            <ul className="list-disc pl-6 text-muted-foreground space-y-2">
              <li>Access your personal data</li>
              <li>Correct inaccurate data</li>
              <li>Delete your data</li>
              <li>Export your data</li>
              <li>Opt out of certain processing activities</li>
            </ul>
          </section>

          <section>
            <h2 className="text-2xl font-semibold mb-4">8. Contact Us</h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have questions about this Privacy Policy, please contact us at:
            </p>
            <p className="text-muted-foreground mt-2">
              Email: <a href={`mailto:${APP_CONFIG.contact.privacy}`} className="text-primary hover:underline">{APP_CONFIG.contact.privacy}</a>
            </p>
          </section>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-12">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Koya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
