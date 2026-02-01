"use client";

import { Calendar, Mail, Users, CreditCard, Scissors, Building2, Heart, Sparkles } from "lucide-react";

interface Integration {
  id: string;
  name: string;
  category: string;
  icon: React.ReactNode;
  color: string;
}

const integrations: Integration[] = [
  // Calendar & Scheduling
  { id: "google-calendar", name: "Google Calendar", category: "Calendar", icon: <Calendar className="w-6 h-6" />, color: "from-blue-500 to-blue-600" },
  { id: "outlook", name: "Microsoft Outlook", category: "Calendar", icon: <Mail className="w-6 h-6" />, color: "from-blue-600 to-blue-700" },
  { id: "calendly", name: "Calendly", category: "Scheduling", icon: <Calendar className="w-6 h-6" />, color: "from-blue-400 to-cyan-500" },
  { id: "acuity", name: "Acuity", category: "Scheduling", icon: <Calendar className="w-6 h-6" />, color: "from-emerald-500 to-emerald-600" },

  // Salon & Beauty
  { id: "vagaro", name: "Vagaro", category: "Salon", icon: <Scissors className="w-6 h-6" />, color: "from-purple-500 to-purple-600" },
  { id: "fresha", name: "Fresha", category: "Salon", icon: <Sparkles className="w-6 h-6" />, color: "from-teal-500 to-teal-600" },
  { id: "booksy", name: "Booksy", category: "Salon", icon: <Scissors className="w-6 h-6" />, color: "from-orange-500 to-orange-600" },
  { id: "mindbody", name: "Mindbody", category: "Wellness", icon: <Heart className="w-6 h-6" />, color: "from-pink-500 to-rose-500" },

  // Business & CRM
  { id: "square", name: "Square", category: "Payments", icon: <CreditCard className="w-6 h-6" />, color: "from-zinc-700 to-zinc-800" },
  { id: "salesforce", name: "Salesforce", category: "CRM", icon: <Users className="w-6 h-6" />, color: "from-blue-500 to-sky-500" },
  { id: "hubspot", name: "HubSpot", category: "CRM", icon: <Users className="w-6 h-6" />, color: "from-orange-500 to-red-500" },
  { id: "zoho", name: "Zoho CRM", category: "CRM", icon: <Building2 className="w-6 h-6" />, color: "from-red-500 to-red-600" },

  // More integrations
  { id: "stripe", name: "Stripe", category: "Payments", icon: <CreditCard className="w-6 h-6" />, color: "from-violet-500 to-purple-600" },
  { id: "quickbooks", name: "QuickBooks", category: "Accounting", icon: <Building2 className="w-6 h-6" />, color: "from-green-500 to-green-600" },
  { id: "mailchimp", name: "Mailchimp", category: "Email", icon: <Mail className="w-6 h-6" />, color: "from-yellow-500 to-yellow-600" },
  { id: "zendesk", name: "Zendesk", category: "Support", icon: <Users className="w-6 h-6" />, color: "from-emerald-600 to-emerald-700" },
];

function IntegrationCard({ integration }: { integration: Integration }) {
  return (
    <div className="flex-shrink-0 w-[160px] mx-2">
      <div className="glass rounded-xl p-4 h-full flex flex-col items-center justify-center gap-3 hover:border-white/20 transition-all cursor-default group">
        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${integration.color} flex items-center justify-center text-white group-hover:scale-110 transition-transform`}>
          {integration.icon}
        </div>
        <div className="text-center">
          <p className="text-white font-medium text-sm">{integration.name}</p>
          <p className="text-zinc-500 text-xs">{integration.category}</p>
        </div>
      </div>
    </div>
  );
}

export function IntegrationsCarousel() {
  // Double the items for seamless loop
  const doubledIntegrations = [...integrations, ...integrations];

  return (
    <section className="py-16 md:py-24 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent pointer-events-none" />

      <div className="container mx-auto px-4">
        {/* Heading */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-zinc-300">Seamless Integrations</span>
          </div>
          <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-4">
            <span className="text-white">Connect with </span>
            <span className="text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text">5,000+</span>
            <span className="text-white"> Tools</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Koya integrates with your favorite booking systems, calendars, CRMs, and business tools.
            If you use it, we probably connect to it.
          </p>
        </div>

        {/* Smooth CSS Carousel */}
        <div className="relative max-w-6xl mx-auto">
          {/* Fade edges */}
          <div className="absolute inset-y-0 left-0 w-20 bg-gradient-to-r from-background to-transparent pointer-events-none z-10" />
          <div className="absolute inset-y-0 right-0 w-20 bg-gradient-to-l from-background to-transparent pointer-events-none z-10" />

          {/* Scrolling container */}
          <div className="overflow-hidden">
            <div
              className="flex animate-scroll hover:pause-animation"
              style={{
                width: "fit-content",
              }}
            >
              {doubledIntegrations.map((integration, index) => (
                <IntegrationCard key={`${integration.id}-${index}`} integration={integration} />
              ))}
            </div>
          </div>
        </div>

        {/* Stats row */}
        <div className="mt-12 flex flex-wrap justify-center gap-8 md:gap-16">
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text">5,000+</p>
            <p className="text-zinc-400 text-sm">Integrations</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-white">100+</p>
            <p className="text-zinc-400 text-sm">Booking Systems</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-white">50+</p>
            <p className="text-zinc-400 text-sm">CRM Platforms</p>
          </div>
          <div className="text-center">
            <p className="text-3xl md:text-4xl font-bold text-white">24/7</p>
            <p className="text-zinc-400 text-sm">Sync & Updates</p>
          </div>
        </div>
      </div>

      {/* CSS Animation */}
      <style jsx>{`
        @keyframes scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
        .animate-scroll {
          animation: scroll 30s linear infinite;
        }
        .animate-scroll:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
