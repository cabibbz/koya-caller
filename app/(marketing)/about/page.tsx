/**
 * About Page
 */

import { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Zap, Heart, Target, Shield } from "lucide-react";

export const metadata: Metadata = {
  title: "About Us",
  description: "Learn about Koya Caller - the AI-powered phone receptionist helping small businesses never miss a call.",
};

const values = [
  {
    icon: Heart,
    title: "Small Business First",
    description: "We build for the local businesses that make our communities thrive - salons, dental offices, auto shops, and more.",
  },
  {
    icon: Zap,
    title: "Simple & Powerful",
    description: "Enterprise-grade AI technology made accessible. Set up in minutes, not months.",
  },
  {
    icon: Shield,
    title: "Trust & Reliability",
    description: "Your callers are your livelihood. We treat every call with the care it deserves.",
  },
  {
    icon: Target,
    title: "Results Driven",
    description: "We measure success by your success - more bookings, happier customers, better work-life balance.",
  },
];

const stats = [
  { value: "2M+", label: "Calls Handled" },
  { value: "10,000+", label: "Businesses" },
  { value: "98%", label: "Customer Satisfaction" },
  { value: "24/7", label: "Availability" },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Koya
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground">
              Log In
            </Link>
            <Button asChild size="sm">
              <Link href="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-6">
            We believe every call matters
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Koya was born from a simple observation: small businesses were losing customers
            simply because they couldn&apos;t answer the phone. We built an AI receptionist
            that changes that.
          </p>
        </div>
      </section>

      {/* Mission */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="grid md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-3xl font-bold mb-4">Our Mission</h2>
                <p className="text-muted-foreground mb-4">
                  Small businesses are the backbone of our economy, yet they often can&apos;t
                  afford the staff to answer every call. A missed call means a missed
                  opportunity - a customer who goes to a competitor, an emergency that
                  doesn&apos;t get handled.
                </p>
                <p className="text-muted-foreground">
                  We&apos;re on a mission to give every small business an AI receptionist
                  that&apos;s always available, always professional, and actually helpful.
                  Not a cold robot, but a warm voice that represents your business the
                  way you would.
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {stats.map((stat) => (
                  <Card key={stat.label}>
                    <CardContent className="p-6 text-center">
                      <p className="text-3xl font-bold text-primary">{stat.value}</p>
                      <p className="text-sm text-muted-foreground mt-1">{stat.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">What We Stand For</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Our values guide everything we do, from product decisions to customer support.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
            {values.map((value) => (
              <Card key={value.title}>
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                    <value.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{value.title}</h3>
                  <p className="text-sm text-muted-foreground">{value.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How It Started */}
      <section className="py-16 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-3xl font-bold mb-6">How It Started</h2>
            <p className="text-muted-foreground mb-4">
              Koya started when our founder watched his local barber lose a customer
              because he couldn&apos;t answer the phone mid-haircut. That customer never
              called back.
            </p>
            <p className="text-muted-foreground mb-4">
              We realized that AI had finally reached a point where it could have
              natural, helpful conversations - but this technology was only available
              to big corporations with big budgets.
            </p>
            <p className="text-muted-foreground">
              So we built Koya: an AI receptionist designed specifically for small
              businesses, priced for small businesses, and easy enough for anyone to
              set up in minutes.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to never miss a call?</h2>
          <p className="text-muted-foreground mb-8 max-w-xl mx-auto">
            Join thousands of businesses using Koya to capture every opportunity.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button size="lg" asChild>
              <Link href="/signup">Start Free Trial</Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link href="/contact">Contact Us</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
            <Link href="/contact" className="hover:text-foreground">Contact</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Koya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
