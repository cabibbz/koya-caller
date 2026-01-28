"use client";

/**
 * Glassmorphism Feature Cards
 * Floating cards highlighting key features
 */

import { motion } from "framer-motion";
import { Phone, Calendar, MessageSquare, Clock } from "lucide-react";

const features = [
  {
    icon: Phone,
    title: "24/7 Answering",
    description: "Never miss a call",
    color: "from-purple-500 to-violet-600",
    delay: 0,
  },
  {
    icon: Calendar,
    title: "Book Appointments",
    description: "Syncs with your calendar",
    color: "from-cyan-500 to-blue-600",
    delay: 0.1,
  },
  {
    icon: MessageSquare,
    title: "Answer Questions",
    description: "Knows your business",
    color: "from-pink-500 to-rose-600",
    delay: 0.2,
  },
  {
    icon: Clock,
    title: "Save Hours",
    description: "Focus on what matters",
    color: "from-amber-500 to-orange-600",
    delay: 0.3,
  },
];

export function FeatureCards() {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
      {features.map((feature) => (
        <motion.div
          key={feature.title}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 + feature.delay, duration: 0.5 }}
          whileHover={{ scale: 1.05, y: -5 }}
          className="group"
        >
          <div className="glass rounded-2xl p-4 h-full cursor-pointer transition-all duration-300 hover:border-white/20">
            {/* Icon */}
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
            >
              <feature.icon className="w-5 h-5 text-white" />
            </div>

            {/* Text */}
            <h3 className="text-white font-semibold text-sm mb-1">
              {feature.title}
            </h3>
            <p className="text-zinc-400 text-xs">{feature.description}</p>

            {/* Hover glow */}
            <motion.div
              className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.color} opacity-0 group-hover:opacity-10 transition-opacity -z-10 blur-xl`}
            />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function FloatingFeatureCard({
  position,
  children,
  delay = 0,
}: {
  position: string;
  children: React.ReactNode;
  delay?: number;
}) {
  return (
    <motion.div
      className={`absolute ${position} glass rounded-xl px-4 py-3 hidden lg:block`}
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 2 + delay, duration: 0.5 }}
      whileHover={{ scale: 1.05 }}
    >
      <motion.div
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, delay }}
      >
        {children}
      </motion.div>
    </motion.div>
  );
}
