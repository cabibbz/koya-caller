"use client";

/**
 * Contact Page Client Component
 */

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, Phone, MapPin, Send, CheckCircle, Loader2 } from "lucide-react";
import { APP_CONFIG } from "@/lib/config";

export function ContactPageClient() {
  const [formState, setFormState] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate form submission
    await new Promise((resolve) => setTimeout(resolve, 1000));

    setIsSubmitting(false);
    setIsSubmitted(true);
  };

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
      <section className="py-16 text-center">
        <div className="container mx-auto px-4">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">Get in Touch</h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Have questions about Koya? We&apos;re here to help. Reach out and we&apos;ll get back to you as soon as possible.
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="pb-20">
        <div className="container mx-auto px-4">
          <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {/* Contact Info */}
            <div className="space-y-6">
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Mail className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Email Us</h3>
                      <p className="text-sm text-muted-foreground mb-2">For general inquiries</p>
                      <a
                        href={`mailto:${APP_CONFIG.contact.general}`}
                        className="text-primary hover:underline text-sm"
                      >
                        {APP_CONFIG.contact.general}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Phone className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Call Us</h3>
                      <p className="text-sm text-muted-foreground mb-2">Mon-Fri, 9am-6pm PT</p>
                      <a
                        href={`tel:${APP_CONFIG.phone.support}`}
                        className="text-primary hover:underline text-sm"
                      >
                        {APP_CONFIG.phone.supportDisplay}
                      </a>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-semibold mb-1">Office</h3>
                      <p className="text-sm text-muted-foreground">
                        San Francisco, CA<br />
                        United States
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Support Links */}
              <div className="pt-4">
                <h3 className="font-semibold mb-3">Quick Links</h3>
                <ul className="space-y-2 text-sm">
                  <li>
                    <Link href="/pricing" className="text-muted-foreground hover:text-foreground">
                      View Pricing
                    </Link>
                  </li>
                  <li>
                    <Link href="/#faq" className="text-muted-foreground hover:text-foreground">
                      FAQs
                    </Link>
                  </li>
                  <li>
                    <a href={`mailto:${APP_CONFIG.contact.support}`} className="text-muted-foreground hover:text-foreground">
                      Technical Support
                    </a>
                  </li>
                </ul>
              </div>
            </div>

            {/* Contact Form */}
            <div className="lg:col-span-2">
              <Card>
                <CardContent className="p-6 md:p-8">
                  {isSubmitted ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                        <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-2xl font-semibold mb-2">Message Sent!</h3>
                      <p className="text-muted-foreground mb-6">
                        Thanks for reaching out. We&apos;ll get back to you within 24 hours.
                      </p>
                      <Button variant="outline" onClick={() => setIsSubmitted(false)}>
                        Send Another Message
                      </Button>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="name">Name</Label>
                          <Input
                            id="name"
                            placeholder="Your name"
                            value={formState.name}
                            onChange={(e) =>
                              setFormState({ ...formState, name: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="email">Email</Label>
                          <Input
                            id="email"
                            type="email"
                            placeholder="you@example.com"
                            value={formState.email}
                            onChange={(e) =>
                              setFormState({ ...formState, email: e.target.value })
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="subject">Subject</Label>
                        <Input
                          id="subject"
                          placeholder="How can we help?"
                          value={formState.subject}
                          onChange={(e) =>
                            setFormState({ ...formState, subject: e.target.value })
                          }
                          required
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="message">Message</Label>
                        <Textarea
                          id="message"
                          placeholder="Tell us more about your question or feedback..."
                          rows={6}
                          value={formState.message}
                          onChange={(e) =>
                            setFormState({ ...formState, message: e.target.value })
                          }
                          required
                        />
                      </div>

                      <Button type="submit" className="w-full" disabled={isSubmitting}>
                        {isSubmitting ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Send className="w-4 h-4 mr-2" />
                            Send Message
                          </>
                        )}
                      </Button>
                    </form>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <div className="flex justify-center gap-6 mb-4">
            <Link href="/privacy" className="hover:text-foreground">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-foreground">Terms of Service</Link>
          </div>
          <p>&copy; {new Date().getFullYear()} Koya. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
