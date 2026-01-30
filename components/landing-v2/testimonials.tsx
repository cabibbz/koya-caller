"use client";

/**
 * Testimonials V2 Section
 * Glassmorphism design with animations
 */

import { motion } from "framer-motion";
import { Star, Quote, Sparkles } from "lucide-react";

const testimonials = [
  {
    name: "Sarah Mitchell",
    role: "Owner, Luxe Hair Studio",
    content:
      "Koya has completely transformed how we handle calls. We used to miss 30% of calls when stylists were busy. Now we capture every single one. Our bookings are up 40% since we started using it.",
    rating: 5,
    industry: "Salon",
  },
  {
    name: "Dr. James Chen",
    role: "Dentist, Smile Dental Care",
    content:
      "The best investment we made this year. Patients love that they can book appointments 24/7, and my front desk staff can focus on in-person care instead of being tied to the phone.",
    rating: 5,
    industry: "Dental",
  },
  {
    name: "Mike Rodriguez",
    role: "Owner, Premier Auto Repair",
    content:
      "I was skeptical about AI answering calls for my auto shop, but Koya handles it perfectly. It even speaks Spanish for our Hispanic customers. Game changer for our business.",
    rating: 5,
    industry: "Auto",
  },
  {
    name: "Jennifer Park",
    role: "Manager, Serenity Spa",
    content:
      "Our clients expect a premium experience from the first call. Koya delivers that with a warm, professional voice that matches our brand perfectly. Worth every penny.",
    rating: 5,
    industry: "Spa",
  },
  {
    name: "David Thompson",
    role: "Owner, Thompson Plumbing",
    content:
      "Emergency calls used to wake me up at 3 AM. Now Koya handles them, schedules the urgent ones, and I wake up to a full calendar. Finally getting some sleep!",
    rating: 5,
    industry: "HVAC",
  },
  {
    name: "Lisa Chen",
    role: "Photographer, Captured Moments",
    content:
      "As a solo photographer, I can't answer calls during shoots. Koya books consultations while I work, and I've doubled my client inquiries. It pays for itself 10x over.",
    rating: 5,
    industry: "Photography",
  },
];

const stats = [
  { value: "10,000+", label: "Businesses" },
  { value: "2M+", label: "Calls Handled" },
  { value: "98%", label: "Satisfaction" },
  { value: "4.9", label: "Average Rating" },
];

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`w-4 h-4 ${
            i < rating ? "fill-yellow-400 text-yellow-400" : "text-zinc-600"
          }`}
        />
      ))}
    </div>
  );
}

export function TestimonialsV2() {
  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 text-purple-400 text-sm mb-6"
          >
            <Sparkles className="w-4 h-4" />
            Trusted by thousands
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Loved by businesses{" "}
            <span className="text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text">
              everywhere
            </span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            See why business owners choose Koya to handle their calls.
          </p>
        </motion.div>

        {/* Testimonial Grid */}
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {testimonials.map((testimonial, i) => (
            <motion.div
              key={testimonial.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -5, scale: 1.02 }}
              className="glass rounded-2xl p-6 group"
            >
              {/* Quote icon */}
              <Quote className="w-8 h-8 text-purple-500/30 mb-4" />

              {/* Rating */}
              <StarRating rating={testimonial.rating} />

              {/* Content */}
              <p className="mt-4 text-zinc-300 leading-relaxed">
                &ldquo;{testimonial.content}&rdquo;
              </p>

              {/* Author */}
              <div className="mt-6 flex items-center gap-4">
                <motion.div
                  whileHover={{ scale: 1.1, rotate: 5 }}
                  className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center text-white font-semibold"
                >
                  {testimonial.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")}
                </motion.div>
                <div>
                  <p className="font-semibold text-white">{testimonial.name}</p>
                  <p className="text-sm text-zinc-400">{testimonial.role}</p>
                </div>
              </div>

              {/* Industry badge */}
              <div className="mt-4 inline-block px-3 py-1 rounded-full bg-white/5 text-xs text-zinc-400">
                {testimonial.industry}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="glass rounded-2xl p-8"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
            {stats.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <motion.p
                  className="text-4xl md:text-5xl font-bold text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text"
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                >
                  {stat.value}
                </motion.p>
                <p className="text-sm text-zinc-400 mt-1">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
