/**
 * Koya Caller - Landing Page
 * Glassmorphism + 3D + Animated Koya design
 */

import {
  HeroSectionV2,
  NavigationV2,
  PricingSectionV2,
  HowItWorksV2,
  FAQSectionV2,
  FooterV2,
  TestimonialsV2,
  VoicePreviewWidget,
  LiveStatsSection,
  FloatingCTA,
  DemoSection,
  ComparisonSection,
  CTASection,
  IntegrationsCarousel,
} from "@/components/landing-v2";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-background">
      <NavigationV2 />
      <HeroSectionV2 />
      <LiveStatsSection />
      <DemoSection />
      <VoicePreviewWidget />
      <IntegrationsCarousel />
      <HowItWorksV2 />
      <ComparisonSection />
      <TestimonialsV2 />
      <PricingSectionV2 />
      <FAQSectionV2 />
      <CTASection />
      <FooterV2 />
      <FloatingCTA />
    </main>
  );
}
