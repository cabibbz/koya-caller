"use client";

/**
 * Pricing Section V2
 * Interactive slider + Glassmorphism cards + Animations
 * Fetches pricing from site settings API
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Check,
  Star,
  Zap,
  Phone,
  Calendar,
  MessageSquare,
  BarChart3,
  Headphones,
  Sparkles,
} from "lucide-react";
import { useTranslations } from "next-intl";

// Default pricing tiers
const defaultTiers = [
  {
    id: "starter",
    name: "Starter",
    description: "Perfect for small businesses",
    icon: Phone,
    basePrice: 99,
    baseMinutes: 200,
    baseCalls: 40,
    color: "from-blue-500 to-cyan-500",
    features: [
      { text: "24/7 AI answering", included: true },
      { text: "Appointment booking", included: true },
      { text: "Custom FAQs", included: true },
      { text: "Message taking", included: true },
      { text: "English + Spanish", included: true },
      { text: "SMS alerts", included: false },
      { text: "Call recordings", included: false },
      { text: "Analytics dashboard", included: false },
    ],
    cta: "Get Started",
  },
  {
    id: "professional",
    name: "Professional",
    description: "Most popular for growing businesses",
    icon: Zap,
    basePrice: 197,
    baseMinutes: 800,
    baseCalls: 160,
    color: "from-purple-500 to-pink-500",
    popular: true,
    features: [
      { text: "24/7 AI answering", included: true },
      { text: "Appointment booking", included: true },
      { text: "Custom FAQs", included: true },
      { text: "Message taking", included: true },
      { text: "English + Spanish", included: true },
      { text: "SMS alerts", included: true },
      { text: "Call recordings", included: true },
      { text: "Analytics dashboard", included: true },
    ],
    cta: "Get Started",
  },
  {
    id: "business",
    name: "Business",
    description: "For high-volume operations",
    icon: BarChart3,
    basePrice: 397,
    baseMinutes: 2000,
    baseCalls: 400,
    color: "from-amber-500 to-orange-500",
    features: [
      { text: "24/7 AI answering", included: true },
      { text: "Appointment booking", included: true },
      { text: "Custom FAQs", included: true },
      { text: "Message taking", included: true },
      { text: "English + Spanish", included: true },
      { text: "SMS alerts", included: true },
      { text: "Call recordings", included: true },
      { text: "Analytics dashboard", included: true },
      { text: "Priority support", included: true },
      { text: "Custom integrations", included: true },
    ],
    cta: "Contact Sales",
  },
];

export function PricingSectionV2() {
  const t = useTranslations("landing");
  const [isAnnual, setIsAnnual] = useState(false);
  const [hoveredCard, setHoveredCard] = useState<string | null>(null);
  const [tiers, setTiers] = useState(defaultTiers);

  // Fetch pricing settings
  useEffect(() => {
    async function fetchPricing() {
      try {
        const res = await fetch("/api/site/settings?category=pricing");
        const data = await res.json();
        if (data.settings) {
          // Update tiers with settings values
          setTiers((current) =>
            current.map((tier) => {
              const key = `pricing_${tier.id === "business" ? "enterprise" : tier.id}`;
              const setting = data.settings[key];
              if (setting) {
                return {
                  ...tier,
                  name: setting.name || tier.name,
                  description: setting.description || tier.description,
                  basePrice: setting.price || tier.basePrice,
                  baseMinutes: setting.minutes || tier.baseMinutes,
                  baseCalls: Math.round((setting.minutes || tier.baseMinutes) / 5),
                  cta: setting.cta || tier.cta,
                  popular: setting.highlighted || tier.popular,
                  features: setting.features
                    ? setting.features.map((f: string) => ({ text: f, included: true }))
                    : tier.features,
                };
              }
              return tier;
            })
          );
        }
      } catch (_error) {
        // Error handled silently
      }
    }
    fetchPricing();
  }, []);

  // Annual discount
  const annualDiscount = 0.2; // 20% off

  const getPrice = (basePrice: number) => {
    if (isAnnual) {
      return Math.round(basePrice * (1 - annualDiscount));
    }
    return basePrice;
  };

  return (
    <section id="pricing" className="py-24 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-12"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-zinc-300">{t("pricing.sectionTitle")}</span>
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">{t("pricing.chooseYour")} </span>
            <span className="text-shimmer">{t("pricing.perfectPlan")}</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            {t("pricing.sectionSubtitle")}
          </p>
        </motion.div>

        {/* Billing Toggle */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-4 mb-12"
        >
          <span
            className={`text-sm font-medium transition-colors ${
              !isAnnual ? "text-white" : "text-zinc-500"
            }`}
          >
            {t("pricing.monthly")}
          </span>

          {/* Toggle Switch */}
          <button
            onClick={() => setIsAnnual(!isAnnual)}
            className={`relative w-16 h-8 rounded-full transition-colors ${
              isAnnual
                ? "bg-gradient-to-r from-purple-500 to-cyan-500"
                : "bg-zinc-700"
            }`}
          >
            <motion.div
              className="absolute top-1 w-6 h-6 bg-white rounded-full shadow-lg"
              animate={{ left: isAnnual ? "calc(100% - 28px)" : "4px" }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </button>

          <span
            className={`text-sm font-medium transition-colors ${
              isAnnual ? "text-white" : "text-zinc-500"
            }`}
          >
            {t("pricing.annual")}
          </span>

          {/* Savings Badge */}
          <AnimatePresence>
            {isAnnual && (
              <motion.span
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.8, x: -10 }}
                className="px-3 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-full"
              >
                {t("pricing.save20")}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {tiers.map((tier, index) => (
            <motion.div
              key={tier.id}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
              onMouseEnter={() => setHoveredCard(tier.id)}
              onMouseLeave={() => setHoveredCard(null)}
              className={`relative group ${tier.popular ? "md:-mt-4 md:mb-4" : ""}`}
            >
              {/* Glow effect for popular card */}
              {tier.popular && (
                <motion.div
                  className="absolute -inset-1 bg-gradient-to-r from-purple-500 via-pink-500 to-cyan-500 rounded-3xl blur-lg opacity-50"
                  animate={{
                    opacity: hoveredCard === tier.id ? 0.8 : 0.5,
                  }}
                />
              )}

              {/* Card */}
              <div
                className={`relative h-full rounded-2xl p-6 lg:p-8 transition-all duration-300 ${
                  tier.popular
                    ? "glass-strong border-purple-500/50"
                    : "glass border-white/10 hover:border-white/20"
                }`}
              >
                {/* Popular Badge */}
                {tier.popular && (
                  <motion.div
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    className="absolute -top-4 left-1/2 -translate-x-1/2"
                  >
                    <motion.span
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full text-xs font-bold text-white shadow-lg shadow-purple-500/30"
                      animate={{
                        boxShadow: [
                          "0 10px 30px -10px rgba(168, 85, 247, 0.3)",
                          "0 10px 30px -10px rgba(168, 85, 247, 0.6)",
                          "0 10px 30px -10px rgba(168, 85, 247, 0.3)",
                        ],
                      }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Star className="w-3 h-3 fill-current" />
                      {t("pricing.mostPopular")}
                    </motion.span>
                  </motion.div>
                )}

                {/* Header */}
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${tier.color} flex items-center justify-center`}
                  >
                    <tier.icon className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-white">{tier.name}</h3>
                    <p className="text-xs text-zinc-500">{tier.description}</p>
                  </div>
                </div>

                {/* Price */}
                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl lg:text-5xl font-bold text-white">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={isAnnual ? "annual" : "monthly"}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          transition={{ duration: 0.2 }}
                        >
                          ${getPrice(tier.basePrice)}
                        </motion.span>
                      </AnimatePresence>
                    </span>
                    <span className="text-zinc-500">{t("pricing.perMonth")}</span>
                  </div>
                  {isAnnual && (
                    <motion.p
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs text-zinc-500 mt-1"
                    >
                      <span className="line-through">${tier.basePrice}</span>
                      <span className="text-emerald-400 ml-2">{t("pricing.billedAnnually")}</span>
                    </motion.p>
                  )}
                </div>

                {/* Minutes/Calls */}
                <div className="glass-light rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold text-white">
                        {tier.baseMinutes.toLocaleString()}
                      </p>
                      <p className="text-xs text-zinc-500">{t("pricing.minutesMonth")}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-semibold text-zinc-300">
                        ~{tier.baseCalls}
                      </p>
                      <p className="text-xs text-zinc-500">{t("pricing.calls")}</p>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <ul className="space-y-3 mb-8">
                  {tier.features.map((feature, i) => (
                    <motion.li
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      transition={{ delay: index * 0.1 + i * 0.05 }}
                      className="flex items-center gap-3"
                    >
                      <div
                        className={`w-5 h-5 rounded-full flex items-center justify-center ${
                          feature.included
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-zinc-800 text-zinc-600"
                        }`}
                      >
                        <Check className="w-3 h-3" />
                      </div>
                      <span
                        className={
                          feature.included ? "text-zinc-300" : "text-zinc-600"
                        }
                      >
                        {feature.text}
                      </span>
                    </motion.li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  className={`w-full group ${
                    tier.popular
                      ? "bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-400 hover:to-pink-400 text-white border-0"
                      : "glass border-white/20 hover:border-white/40 hover:bg-white/10"
                  }`}
                  size="lg"
                  asChild
                >
                  <Link href="/signup">
                    {tier.cta}
                    <motion.span
                      className="ml-2"
                      animate={{ x: hoveredCard === tier.id ? 5 : 0 }}
                    >
                      →
                    </motion.span>
                  </Link>
                </Button>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
          className="mt-16 text-center"
        >
          <p className="text-zinc-500 mb-6">
            {t("pricing.noContracts")}
          </p>

          <div className="flex flex-wrap items-center justify-center gap-8">
            {[
              { icon: Headphones, text: t("pricing.support247") },
              { icon: Calendar, text: t("pricing.freeTrial") },
              { icon: MessageSquare, text: t("pricing.freeOnboarding") },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: 0.5 + i * 0.1 }}
                className="flex items-center gap-2 text-zinc-400"
              >
                <item.icon className="w-4 h-4 text-purple-400" />
                <span className="text-sm">{item.text}</span>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Enterprise callout */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-12"
        >
          <div className="glass rounded-2xl p-6 md:p-8 text-center">
            <h3 className="text-xl font-bold text-white mb-2">
              {t("pricing.needMore")}
            </h3>
            <p className="text-zinc-400 mb-4">
              {t("pricing.customPricing")}
            </p>
            <Button variant="outline" className="glass border-white/20" asChild>
              <Link href="/contact">{t("pricing.talkToSales")}</Link>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
