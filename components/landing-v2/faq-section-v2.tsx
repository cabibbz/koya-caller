"use client";

/**
 * FAQ Section V2
 * Glassmorphism accordion with smooth animations
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, MessageCircle, Sparkles, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { APP_CONFIG } from "@/lib/config";

const faqs = [
  {
    category: "Getting Started",
    questions: [
      {
        question: "How does Koya know about my business?",
        answer:
          "During setup, you'll tell Koya about your services, business hours, pricing, and frequently asked questions. Koya learns your specific details and uses them to answer customer questions accurately. You can update this information anytime from your dashboard.",
      },
      {
        question: "What phone number do I use?",
        answer:
          "You have two options: get a new local phone number from us, or forward your existing business number to Koya. Either way, setup takes just a few minutes and Koya starts answering calls immediately.",
      },
      {
        question: "Can I keep my existing business number?",
        answer:
          "Absolutely! You can forward your existing business number to Koya. We provide step-by-step instructions for all major carriers. Your customers keep calling the same number they always have.",
      },
    ],
  },
  {
    category: "Features",
    questions: [
      {
        question: "How do customers book appointments?",
        answer:
          "Koya connects to your Google Calendar or Microsoft Outlook. When a customer wants to book, Koya checks your real-time availability and schedules the appointment directly on your calendar. The customer receives an SMS confirmation automatically.",
      },
      {
        question: "What if Koya can't handle a call?",
        answer:
          "Koya is trained to recognize when a call needs human attention. In these cases, she can transfer the call to you or your team, take a detailed message, or schedule a callback. You set the rules for how Koya handles different situations.",
      },
      {
        question: "Can I listen to the calls?",
        answer:
          "Yes! Professional and Business plans include call recordings. You can listen to any call from your dashboard, review transcripts, and see summaries of what was discussed. This helps you stay informed and improve your customer service.",
      },
      {
        question: "Does Koya speak Spanish?",
        answer:
          "Yes! Koya is fully bilingual in English and Spanish. She can detect which language the caller is speaking and respond naturally in that language. All plans include bilingual support at no extra cost.",
      },
    ],
  },
  {
    category: "Billing & Usage",
    questions: [
      {
        question: "What happens when I run out of minutes?",
        answer:
          "You'll receive alerts at 50%, 80%, and 95% usage. If you run out, Koya switches to message-only mode — she'll still answer calls professionally, take messages, and let callers know you'll call them back. No calls are ever missed.",
      },
      {
        question: "What if I already have a calendar system?",
        answer:
          "Koya integrates with Google Calendar and Microsoft Outlook. If you use a different system, Koya can take appointment requests and send you the details to book manually. We're adding more integrations soon.",
      },
    ],
  },
];

function FAQItem({
  question,
  answer,
  isOpen,
  onClick,
  index,
}: {
  question: string;
  answer: string;
  isOpen: boolean;
  onClick: () => void;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.05 }}
      className="group"
    >
      <button
        onClick={onClick}
        className={`w-full glass rounded-xl p-5 text-left transition-all duration-300 ${
          isOpen ? "border-purple-500/50" : "hover:border-white/20"
        }`}
      >
        <div className="flex items-center justify-between gap-4">
          <span className="text-lg font-medium text-white group-hover:text-purple-300 transition-colors">
            {question}
          </span>
          <motion.div
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.3 }}
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
              isOpen ? "bg-purple-500 text-white" : "bg-zinc-800 text-zinc-400"
            }`}
          >
            <ChevronDown className="w-4 h-4" />
          </motion.div>
        </div>

        <AnimatePresence>
          {isOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <p className="text-zinc-400 leading-relaxed pt-4 pr-12">
                {answer}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </button>
    </motion.div>
  );
}

export function FAQSectionV2() {
  const t = useTranslations("landing");
  const [openItems, setOpenItems] = useState<Set<string>>(new Set(["0-0"]));
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  const toggleItem = (id: string) => {
    const newOpenItems = new Set(openItems);
    if (newOpenItems.has(id)) {
      newOpenItems.delete(id);
    } else {
      newOpenItems.add(id);
    }
    setOpenItems(newOpenItems);
  };

  // Filter FAQs based on search and category
  const filteredFaqs = faqs
    .map((category) => ({
      ...category,
      questions: category.questions.filter(
        (q) =>
          (!activeCategory || category.category === activeCategory) &&
          (!searchQuery ||
            q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            q.answer.toLowerCase().includes(searchQuery.toLowerCase()))
      ),
    }))
    .filter((category) => category.questions.length > 0);

  return (
    <section id="faq" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
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
            <MessageCircle className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-zinc-300">{t("faq.gotQuestions")}</span>
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">{t("faq.frequentlyAsked")} </span>
            <span className="text-shimmer">{t("faq.questions")}</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            {t("faq.subtitle")}
          </p>
        </motion.div>

        {/* Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-8"
        >
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
            <input
              type="text"
              placeholder={t("faq.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full glass rounded-xl pl-12 pr-4 py-4 text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
            />
          </div>
        </motion.div>

        {/* Category filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex flex-wrap justify-center gap-2 mb-8"
        >
          <button
            onClick={() => setActiveCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
              !activeCategory
                ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
                : "glass text-zinc-400 hover:text-white"
            }`}
          >
            {t("faq.all")}
          </button>
          {faqs.map((category) => (
            <button
              key={category.category}
              onClick={() => setActiveCategory(category.category)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === category.category
                  ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
                  : "glass text-zinc-400 hover:text-white"
              }`}
            >
              {category.category}
            </button>
          ))}
        </motion.div>

        {/* FAQ List */}
        <div className="space-y-8">
          {filteredFaqs.map((category, categoryIndex) => (
            <div key={category.category}>
              {/* Category header */}
              {!activeCategory && (
                <motion.h3
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  className="text-sm font-medium text-purple-400 mb-4 flex items-center gap-2"
                >
                  <Sparkles className="w-4 h-4" />
                  {category.category}
                </motion.h3>
              )}

              {/* Questions */}
              <div className="space-y-3">
                {category.questions.map((faq, questionIndex) => {
                  const id = `${categoryIndex}-${questionIndex}`;
                  return (
                    <FAQItem
                      key={id}
                      question={faq.question}
                      answer={faq.answer}
                      isOpen={openItems.has(id)}
                      onClick={() => toggleItem(id)}
                      index={questionIndex}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* No results */}
        {filteredFaqs.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <p className="text-zinc-400">{t("faq.noResults")}</p>
          </motion.div>
        )}

        {/* Contact CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mt-12 text-center"
        >
          <div className="glass rounded-2xl p-8">
            <p className="text-zinc-400 mb-4">{t("faq.stillHaveQuestions")}</p>
            <a
              href={`mailto:${APP_CONFIG.contact.general}`}
              className="inline-flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full text-white font-medium hover:opacity-90 transition-opacity"
            >
              <MessageCircle className="w-4 h-4" />
              {t("faq.contactSupport")}
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
