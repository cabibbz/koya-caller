"use client";

/**
 * Page Progress Bar
 * Shows loading progress for page navigation
 */

import { useEffect, useState, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { usePathname, useSearchParams } from "next/navigation";

function PageProgressInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    // Start loading on route change
    setIsLoading(true);
    setProgress(0);

    // Simulate progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 90) {
          clearInterval(interval);
          return prev;
        }
        return prev + Math.random() * 20;
      });
    }, 100);

    // Complete after a short delay
    const timeout = setTimeout(() => {
      setProgress(100);
      setTimeout(() => {
        setIsLoading(false);
      }, 200);
    }, 300);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [pathname, searchParams]);

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          className="fixed top-0 left-0 right-0 h-1 z-[100]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            className="h-full bg-gradient-to-r from-purple-500 via-cyan-400 to-purple-500 bg-[length:200%_100%]"
            style={{ width: `${progress}%` }}
            animate={{
              backgroundPosition: ["0% 0%", "100% 0%"],
            }}
            transition={{
              backgroundPosition: {
                duration: 1,
                repeat: Infinity,
                ease: "linear",
              },
            }}
          />
          {/* Glow effect */}
          <motion.div
            className="absolute right-0 top-0 h-full w-20 bg-gradient-to-l from-cyan-400/50 to-transparent"
            style={{ right: `${100 - progress}%` }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export function PageProgress() {
  return (
    <Suspense fallback={null}>
      <PageProgressInner />
    </Suspense>
  );
}
