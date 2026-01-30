import { Button } from "@/components/ui/button"
import Link from "next/link"
import { ArrowRight, Phone, Calendar, MessageSquare } from "lucide-react"

/**
 * Final CTA Section
 * Spec Reference: Part 2, Lines 127-129
 * 
 * Requirement:
 * - Line 128: "Start Your Free Setup" button
 */
export function CTASection() {
  return (
    <section className="py-24 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0">
        {/* Gradient orbs */}
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-[120px]" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Headline */}
        <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-6">
          <span className="text-foreground">Ready to Never Miss </span>
          <br className="hidden sm:block" />
          <span className="brand-gradient-text">Another Call?</span>
        </h2>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Join hundreds of businesses using Koya to handle their calls, 
          book appointments, and delight customers — 24/7.
        </p>

        {/* CTA Button - Spec Line 128 */}
        <Button 
          size="xl" 
          className="group text-lg px-10"
          asChild
        >
          <Link href="/signup">
            Start Your Free Setup
            <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
          </Link>
        </Button>

        {/* Trust indicators */}
        <p className="text-sm text-muted-foreground mt-6">
          No credit card required • Setup in 5 minutes • Cancel anytime
        </p>

        {/* Feature highlights */}
        <div className="mt-16 grid grid-cols-3 gap-8 max-w-xl mx-auto">
          {[
            { icon: Phone, label: "24/7 Answering" },
            { icon: Calendar, label: "Instant Booking" },
            { icon: MessageSquare, label: "SMS Confirmations" },
          ].map((item, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <div className="w-12 h-12 rounded-xl bg-card border border-border flex items-center justify-center">
                <item.icon className="w-6 h-6 text-accent" />
              </div>
              <span className="text-sm text-muted-foreground">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
