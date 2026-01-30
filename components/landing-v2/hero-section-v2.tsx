"use client";

/**
 * Hero Section V2
 * Glassmorphism + 3D + Animated Koya
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowRight, Play, Sparkles, CheckCircle } from "lucide-react";
import { FloatingOrbs } from "./floating-orbs";
import { Phone3D } from "./phone-3d";
import { KoyaMascot } from "./koya-mascot";
import { FeatureCards } from "./feature-cards";
import { useTranslations } from "next-intl";

export function HeroSectionV2() {
  const t = useTranslations("landing");

  const trustItems = [
    t("hero.noCreditCard"),
    t("hero.fiveMinSetup"),
    t("hero.cancelAnytime"),
  ];

  return (
    <section className="relative min-h-screen flex items-center justify-center pt-20 pb-12 overflow-hidden">
      {/* Animated background orbs */}
      <FloatingOrbs />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.015)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.015)_1px,transparent_1px)] bg-[size:50px_50px] pointer-events-none"
        style={{
          maskImage:
            "radial-gradient(ellipse 80% 80% at 50% 50%, black, transparent)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-12 lg:gap-20 items-center">
          {/* Left side - Content */}
          <div className="text-center lg:text-left">
            {/* Badge with Koya mascot */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6 }}
              className="inline-flex items-center gap-3 glass rounded-full px-4 py-2 mb-8"
            >
              <KoyaMascot size="sm" />
              <span className="text-sm text-zinc-300">
                {t("hero.badge")}
              </span>
              <Sparkles className="w-4 h-4 text-cyan-400" />
            </motion.div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6"
            >
              <span className="text-white">{t("hero.title1")}</span>
              <br />
              <span className="text-shimmer">{t("hero.title2")}</span>
            </motion.h1>

            {/* Subheadline */}
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="text-lg sm:text-xl text-zinc-400 max-w-xl mx-auto lg:mx-0 mb-8 leading-relaxed"
            >
              {t("hero.subtitle")}
            </motion.p>

            {/* Trust indicators */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-8 text-sm text-zinc-400"
            >
              {trustItems.map((item, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>{item}</span>
                </div>
              ))}
            </motion.div>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.4 }}
              className="flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4"
            >
              {/* Primary CTA */}
              <Button
                size="xl"
                className="group w-full sm:w-auto bg-gradient-to-r from-purple-600 to-cyan-600 hover:from-purple-500 hover:to-cyan-500 border-0 text-white shadow-lg shadow-purple-500/25"
                asChild
              >
                <Link href="/signup">
                  {t("hero.cta")}
                  <ArrowRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>

              {/* Secondary CTA */}
              <Button
                size="xl"
                variant="outline"
                className="group w-full sm:w-auto glass border-white/10 hover:border-white/20 hover:bg-white/5"
                asChild
              >
                <Link href="#demo">
                  <Play className="w-4 h-4 mr-2 text-cyan-400" />
                  {t("hero.watchDemo")}
                </Link>
              </Button>
            </motion.div>

            {/* Social proof */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.6, delay: 0.6 }}
              className="mt-12 flex items-center justify-center lg:justify-start gap-4"
            >
              {/* Avatar stack */}
              <div className="flex -space-x-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full bg-gradient-to-br from-zinc-700 to-zinc-800 border-2 border-background flex items-center justify-center text-xs"
                  >
                    {["👩‍⚕️", "💇", "🔧", "🍕", "💼"][i - 1]}
                  </div>
                ))}
              </div>
              <div className="text-sm">
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <span key={i} className="text-yellow-400">
                      ★
                    </span>
                  ))}
                  <span className="text-white ml-1 font-medium">5.0</span>
                </div>
                <p className="text-zinc-500">{t("hero.trustBadge")}</p>
              </div>
            </motion.div>
          </div>

          {/* Right side - 3D Phone */}
          <div className="relative flex items-center justify-center lg:justify-end lg:pr-8">
            <Phone3D />
          </div>
        </div>

        {/* Feature cards below */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 1.2 }}
          className="mt-20"
        >
          <FeatureCards />
        </motion.div>
      </div>
    </section>
  );
}
