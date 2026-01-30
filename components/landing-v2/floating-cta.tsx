"use client";

/**
 * Floating CTA Button
 * Mobile-optimized floating button that appears after scrolling
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, X } from "lucide-react";
import Link from "next/link";

export function FloatingCTA() {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      // Show after scrolling 500px
      if (window.scrollY > 500 && !isDismissed) {
        setIsVisible(true);
      } else if (window.scrollY <= 500) {
        setIsVisible(false);
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isDismissed]);

  const handleDismiss = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDismissed(true);
    setIsVisible(false);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          className="fixed bottom-6 right-6 z-50 md:hidden"
        >
          <Link href="/signup">
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="relative flex items-center gap-3 px-6 py-4 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 shadow-lg shadow-purple-500/25"
            >
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500"
                animate={{
                  scale: [1, 1.2, 1],
                  opacity: [0.5, 0, 0.5],
                }}
                transition={{
                  duration: 2,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
              />

              <Phone className="w-5 h-5 text-white relative z-10" />
              <span className="text-white font-semibold relative z-10">
                Try Koya Free
              </span>

              {/* Dismiss button */}
              <button
                onClick={handleDismiss}
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-zinc-800 flex items-center justify-center hover:bg-zinc-700 transition-colors"
                aria-label="Dismiss"
              >
                <X className="w-3 h-3 text-zinc-400" />
              </button>
            </motion.div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
