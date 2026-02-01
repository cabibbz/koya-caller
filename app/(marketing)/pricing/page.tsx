/**
 * Pricing Page
 */

import { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Simple, transparent pricing for Koya Caller. Choose the plan that fits your business needs. All plans include a 14-day free trial.",
  openGraph: {
    title: "Pricing | Koya Caller",
    description: "Simple, transparent pricing for Koya Caller. Choose the plan that fits your business needs.",
  },
};
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Phone, Zap, Building2, ArrowRight } from "lucide-react";

const plans = [
  {
    name: "Starter",
    description: "Perfect for small businesses just getting started",
    price: 49,
    priceAnnual: 39,
    minutes: 100,
    features: [
      "100 minutes/month",
      "1 phone number",
      "Basic call analytics",
      "Email support",
      "Appointment booking",
      "Call transcripts",
    ],
    cta: "Start Free Trial",
    popular: false,
  },
  {
    name: "Professional",
    description: "For growing businesses that need more power",
    price: 99,
    priceAnnual: 79,
    minutes: 300,
    features: [
      "300 minutes/month",
      "2 phone numbers",
      "Advanced analytics",
      "Priority support",
      "Custom greetings",
      "SMS notifications",
      "Calendar integration",
      "Spanish support",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    description: "For large businesses with high call volumes",
    price: 249,
    priceAnnual: 199,
    minutes: 1000,
    features: [
      "1000 minutes/month",
      "5 phone numbers",
      "White-label options",
      "Dedicated support",
      "API access",
      "Custom integrations",
      "Advanced reporting",
      "Team management",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    popular: false,
  },
];

const faqs = [
  {
    question: "What happens if I go over my minutes?",
    answer: "Additional minutes are billed at $0.15/minute. You&apos;ll receive alerts at 50%, 80%, and 100% usage so you&apos;re never surprised.",
  },
  {
    question: "Can I change plans anytime?",
    answer: "Yes! You can upgrade or downgrade your plan at any time. Changes take effect on your next billing cycle.",
  },
  {
    question: "Is there a free trial?",
    answer: "Yes, all plans include a 14-day free trial with full access to features. No credit card required to start.",
  },
  {
    question: "Do unused minutes roll over?",
    answer: "Minutes reset each billing cycle and don&apos;t roll over. This keeps our pricing simple and predictable.",
  },
  {
    question: "What&apos;s included in a minute?",
    answer: "A minute is any 60 seconds of call time. Calls are rounded up to the nearest minute for billing.",
  },
  {
    question: "Can I cancel anytime?",
    answer: "Yes, you can cancel your subscription at any time. You&apos;ll keep access until the end of your billing period.",
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="text-2xl font-bold">
            Koya
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost">Log In</Button>
            </Link>
            <Link href="/signup">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="py-20 text-center">
        <div className="container mx-auto px-4">
          <Badge variant="secondary" className="mb-4">
            Simple, Transparent Pricing
          </Badge>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Never miss a call again
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
            Choose the plan that fits your business. All plans include a 14-day free trial.
          </p>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {plans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative ${
                  plan.popular ? "border-primary shadow-lg scale-105" : ""
                }`}
              >
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground">
                      Most Popular
                    </Badge>
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="text-2xl">{plan.name}</CardTitle>
                  <CardDescription>{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Price */}
                  <div className="text-center">
                    <div className="flex items-baseline justify-center gap-1">
                      <span className="text-4xl font-bold">${plan.price}</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ${plan.priceAnnual}/mo billed annually
                    </p>
                  </div>

                  {/* Minutes highlight */}
                  <div className="bg-muted rounded-lg p-4 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <Phone className="w-5 h-5 text-primary" />
                      <span className="font-semibold">{plan.minutes} minutes</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      ~{Math.floor(plan.minutes / 3)} calls/month
                    </p>
                  </div>

                  {/* Features */}
                  <ul className="space-y-3">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-center gap-3">
                        <Check className="w-5 h-5 text-primary shrink-0" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                    asChild
                  >
                    <Link href="/signup">
                      {plan.cta}
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Features comparison */}
      <section className="py-20 bg-muted/50">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">All plans include</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Every Koya plan comes with powerful features to help your business succeed.
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Phone className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">24/7 Availability</h3>
              <p className="text-sm text-muted-foreground">
                Koya answers calls around the clock, so you never miss an opportunity.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Instant Setup</h3>
              <p className="text-sm text-muted-foreground">
                Get started in minutes with our simple onboarding process.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-6 h-6 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">Industry Templates</h3>
              <p className="text-sm text-muted-foreground">
                Pre-built templates for salons, dental offices, auto shops, and more.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Frequently Asked Questions</h2>
          </div>
          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {faqs.map((faq) => (
              <div key={faq.question}>
                <h3 className="font-semibold mb-2">{faq.question}</h3>
                <p className="text-sm text-muted-foreground">{faq.answer}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-primary text-primary-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Ready to transform your phone experience?
          </h2>
          <p className="text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join thousands of businesses using Koya to never miss another call.
          </p>
          <Button size="lg" variant="secondary" asChild>
            <Link href="/signup">
              Start Your Free Trial
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>&copy; {new Date().getFullYear()} Koya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
