"use client";

/**
 * How It Works V2
 * Interactive timeline with scroll animations
 */

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { Settings, Phone, MessageSquare, CheckCircle, Sparkles, ArrowRight } from "lucide-react";
import { useTranslations } from "next-intl";

// Step metadata without translated content
const stepMeta = [
  {
    number: "01",
    icon: Settings,
    color: "from-blue-500 to-cyan-500",
    preview: {
      type: "chat",
      messages: [
        { from: "koya", text: "What type of business do you run?" },
        { from: "user", text: "I own a dental clinic" },
        { from: "koya", text: "Great! I'll set up appointment booking and dental FAQs for you." },
      ],
    },
  },
  {
    number: "02",
    icon: Phone,
    color: "from-purple-500 to-pink-500",
    preview: {
      type: "phone",
      number: "(555) 123-4567",
      status: "Active",
    },
  },
  {
    number: "03",
    icon: MessageSquare,
    color: "from-emerald-500 to-teal-500",
    preview: {
      type: "features",
      items: ["Answers calls 24/7", "Books appointments", "Sends confirmations"],
    },
  },
];

function StepPreview({ step }: { step: (typeof stepMeta)[0] }) {
  if (step.preview.type === "chat") {
    return (
      <div className="space-y-3">
        {step.preview.messages?.map((msg, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: msg.from === "user" ? 20 : -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[80%] px-4 py-2 rounded-2xl text-sm ${
                msg.from === "user"
                  ? "bg-purple-500 text-white rounded-br-sm"
                  : "glass-light text-zinc-300 rounded-bl-sm"
              }`}
            >
              {msg.text}
            </div>
          </motion.div>
        ))}
      </div>
    );
  }

  if (step.preview.type === "phone") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        className="glass-light rounded-xl p-4 text-center"
      >
        <p className="text-2xl font-mono font-bold text-white mb-2">
          {step.preview.number}
        </p>
        <div className="flex items-center justify-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-sm text-emerald-400">{step.preview.status}</span>
        </div>
      </motion.div>
    );
  }

  if (step.preview.type === "features") {
    return (
      <div className="space-y-2">
        {step.preview.items?.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="flex items-center gap-3 glass-light rounded-lg px-4 py-3"
          >
            <CheckCircle className="w-5 h-5 text-emerald-400" />
            <span className="text-zinc-300">{item}</span>
          </motion.div>
        ))}
      </div>
    );
  }

  return null;
}

export function HowItWorksV2() {
  const t = useTranslations("landing");
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  const lineHeight = useTransform(scrollYProgress, [0.1, 0.9], ["0%", "100%"]);

  // Build steps with translated content
  const steps = stepMeta.map((meta, idx) => ({
    ...meta,
    title: t(`howItWorks.step${idx + 1}Title`),
    description: t(`howItWorks.step${idx + 1}Desc`),
    duration: t(`howItWorks.step${idx + 1}Time`),
  }));

  return (
    <section
      id="how-it-works"
      ref={containerRef}
      className="py-24 relative overflow-hidden"
    >
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/3 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 left-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6"
          >
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-zinc-300">{t("howItWorks.sectionTitle")}</span>
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">How It </span>
            <span className="text-shimmer">Works</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            {t("howItWorks.sectionSubtitle")}
          </p>
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Animated progress line */}
          <div className="hidden lg:block absolute left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
            <div className="absolute inset-0 bg-zinc-800" />
            <motion.div
              className="absolute top-0 left-0 right-0 bg-gradient-to-b from-purple-500 via-cyan-500 to-emerald-500"
              style={{ height: lineHeight }}
            />
          </div>

          {/* Steps */}
          <div className="space-y-16 lg:space-y-24">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                transition={{ duration: 0.5 }}
                className={`relative grid lg:grid-cols-2 gap-8 lg:gap-16 items-center ${
                  index % 2 === 1 ? "lg:direction-rtl" : ""
                }`}
              >
                {/* Content side */}
                <div className={index % 2 === 1 ? "lg:order-2 lg:text-right" : ""}>
                  {/* Step number badge */}
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", delay: 0.2 }}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r ${step.color} mb-4`}
                  >
                    <span className="text-sm font-bold text-white">
                      Step {step.number}
                    </span>
                    <span className="text-xs text-white/80">{step.duration}</span>
                  </motion.div>

                  {/* Icon and title */}
                  <div
                    className={`flex items-center gap-4 mb-4 ${
                      index % 2 === 1 ? "lg:flex-row-reverse" : ""
                    }`}
                  >
                    <div
                      className={`w-14 h-14 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
                    >
                      <step.icon className="w-7 h-7 text-white" />
                    </div>
                    <h3 className="text-2xl font-bold text-white">{step.title}</h3>
                  </div>

                  <p className="text-zinc-400 text-lg leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Preview side */}
                <div className={index % 2 === 1 ? "lg:order-1" : ""}>
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3 }}
                    className="glass rounded-2xl p-6"
                  >
                    <StepPreview step={step} />
                  </motion.div>
                </div>

                {/* Center dot on timeline */}
                <motion.div
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  className="hidden lg:block absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                >
                  <div
                    className={`w-6 h-6 rounded-full bg-gradient-to-r ${step.color} border-4 border-background shadow-lg`}
                  />
                </motion.div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Bottom CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-20 text-center"
        >
          <div className="glass rounded-2xl p-8 max-w-xl mx-auto">
            <p className="text-zinc-400 mb-2">{t("howItWorks.readyText")}</p>
            <p className="text-xl font-bold text-white mb-4">
              {t("howItWorks.setupTime")}
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full text-white font-medium"
            >
              {t("hero.cta")}
              <ArrowRight className="w-4 h-4" />
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
