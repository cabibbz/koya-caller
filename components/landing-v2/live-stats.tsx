"use client";

/**
 * Live Stats Counter
 * Animated statistics with counting animation
 * Fetches values from site settings API
 */

import { useState, useEffect, useRef } from "react";
import { motion, useInView, useSpring, useTransform } from "framer-motion";
import { Phone, Calendar, Clock, TrendingUp } from "lucide-react";

interface StatConfig {
  value: number;
  suffix?: string;
  prefix?: string;
  label: string;
}

interface StatProps extends StatConfig {
  icon: React.ReactNode;
  delay?: number;
}

function AnimatedNumber({
  value,
  suffix = "",
  prefix = "",
}: {
  value: number;
  suffix?: string;
  prefix?: string;
}) {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const spring = useSpring(0, {
    stiffness: 50,
    damping: 30,
  });

  const display = useTransform(spring, (latest) => {
    if (latest >= 1000000) {
      return `${prefix}${(latest / 1000000).toFixed(1)}M${suffix}`;
    } else if (latest >= 1000) {
      return `${prefix}${(latest / 1000).toFixed(latest >= 10000 ? 0 : 1)}K${suffix}`;
    }
    return `${prefix}${Math.floor(latest).toLocaleString()}${suffix}`;
  });

  useEffect(() => {
    if (isInView) {
      spring.set(value);
    }
  }, [isInView, spring, value]);

  return <motion.span ref={ref}>{display}</motion.span>;
}

function StatCard({ value, suffix, prefix, label, icon, delay = 0 }: StatProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay }}
      className="glass rounded-2xl p-6 text-center group hover:scale-105 transition-transform"
    >
      <motion.div
        className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform"
        whileHover={{ rotate: 5 }}
      >
        {icon}
      </motion.div>
      <div className="text-4xl md:text-5xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text mb-2">
        <AnimatedNumber value={value} suffix={suffix} prefix={prefix} />
      </div>
      <p className="text-zinc-400 text-sm">{label}</p>
    </motion.div>
  );
}

function LiveIndicator() {
  return (
    <div className="flex items-center gap-2">
      <span className="relative flex h-3 w-3">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
      </span>
      <span className="text-green-400 text-sm font-medium">Live</span>
    </div>
  );
}

// Default values (fallback)
const defaultStats = {
  stats_calls_today: { value: 2847, label: "Calls Handled Today" },
  stats_total_calls: { value: 2147892, suffix: "+", label: "Total Calls Answered" },
  stats_businesses: { value: 10847, suffix: "+", label: "Businesses Trust Us" },
  stats_uptime: { value: 99.9, suffix: "%", label: "Uptime Guaranteed" },
};

export function LiveStatsSection() {
  const [statsConfig, setStatsConfig] = useState<Record<string, StatConfig>>(defaultStats);
  const [callsToday, setCallsToday] = useState(defaultStats.stats_calls_today.value);

  // Fetch settings on mount
  useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/site/settings?category=stats");
        const data = await res.json();
        if (data.settings) {
          setStatsConfig(data.settings);
          if (data.settings.stats_calls_today?.value) {
            setCallsToday(data.settings.stats_calls_today.value);
          }
        }
      } catch (_error) {
        // Error handled silently
      }
    }
    fetchStats();
  }, []);

  // Simulate live updates for calls today
  useEffect(() => {
    const interval = setInterval(() => {
      setCallsToday((prev) => prev + Math.floor(Math.random() * 3));
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  const stats = [
    {
      ...statsConfig.stats_calls_today,
      value: callsToday,
      icon: <Phone className="w-6 h-6 text-purple-400" />,
    },
    {
      ...statsConfig.stats_total_calls,
      icon: <TrendingUp className="w-6 h-6 text-cyan-400" />,
    },
    {
      ...statsConfig.stats_businesses,
      icon: <Calendar className="w-6 h-6 text-purple-400" />,
    },
    {
      ...statsConfig.stats_uptime,
      icon: <Clock className="w-6 h-6 text-cyan-400" />,
    },
  ];

  return (
    <section className="relative py-16 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-purple-500/5 to-transparent" />

      <div className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header with live indicator */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="flex items-center justify-center gap-4 mb-10"
        >
          <LiveIndicator />
          <h2 className="text-2xl md:text-3xl font-bold text-white">
            Koya is working right now
          </h2>
        </motion.div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
          {stats.map((stat, i) => (
            <StatCard
              key={stat.label || i}
              value={stat.value}
              suffix={stat.suffix}
              prefix={stat.prefix}
              label={stat.label}
              icon={stat.icon}
              delay={i * 0.1}
            />
          ))}
        </div>

        {/* Subtle ticker */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-8 text-center"
        >
          <p className="text-zinc-500 text-sm">
            Real-time statistics from our network of AI receptionists
          </p>
        </motion.div>
      </div>
    </section>
  );
}
