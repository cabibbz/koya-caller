"use client";

/**
 * Koya Learning Animation
 * Shows Koya "learning" about the business with animated facts
 */

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { KoyaAvatar } from "./koya-avatar";
import { Check, Sparkles, Brain, BookOpen, MessageSquare, Calendar, Globe } from "lucide-react";

interface LearningAnimationProps {
  businessType: string;
  websiteUrl?: string;
  onComplete?: () => void;
  className?: string;
}

interface LearningItem {
  id: string;
  text: string;
  icon: React.ElementType;
  complete: boolean;
}

export function LearningAnimation({
  businessType,
  websiteUrl,
  onComplete,
  className,
}: LearningAnimationProps) {
  const [items, setItems] = useState<LearningItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const onCompleteCalledRef = useRef(false);

  // Generate learning items based on business type and website
  useEffect(() => {
    const learningItems: LearningItem[] = [];

    // Add website scanning step if URL provided
    if (websiteUrl) {
      learningItems.push({
        id: "website",
        text: "Scanning your website for info...",
        icon: Globe,
        complete: false,
      });
    }

    learningItems.push(
      {
        id: "services",
        text: `Loading ${businessType} services...`,
        icon: BookOpen,
        complete: false,
      },
      {
        id: "faqs",
        text: "Adding common questions & answers...",
        icon: MessageSquare,
        complete: false,
      },
      {
        id: "scheduling",
        text: "Configuring appointment scheduling...",
        icon: Calendar,
        complete: false,
      },
      {
        id: "optimization",
        text: "Optimizing for your industry...",
        icon: Sparkles,
        complete: false,
      }
    );

    setItems(learningItems);
  }, [businessType, websiteUrl]);

  // Animate through items
  useEffect(() => {
    if (items.length === 0) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => {
        if (prev >= items.length - 1) {
          clearInterval(interval);
          setTimeout(() => {
            setIsComplete(true);
            // Only call onComplete once
            if (!onCompleteCalledRef.current) {
              onCompleteCalledRef.current = true;
              onComplete?.();
            }
          }, 500);
          return prev;
        }

        // Mark current item as complete
        setItems((prevItems) =>
          prevItems.map((item, i) =>
            i === prev ? { ...item, complete: true } : item
          )
        );

        return prev + 1;
      });
    }, 1200);

    return () => clearInterval(interval);
  }, [items.length, onComplete]);

  // Mark final item as complete when done
  useEffect(() => {
    if (currentIndex === items.length - 1 && items.length > 0) {
      setTimeout(() => {
        setItems((prevItems) =>
          prevItems.map((item, i) =>
            i === currentIndex ? { ...item, complete: true } : item
          )
        );
      }, 1000);
    }
  }, [currentIndex, items.length]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-card border border-border rounded-2xl p-6 max-w-md mx-auto",
        className
      )}
    >
      {/* Header with Koya */}
      <div className="flex items-center gap-4 mb-6">
        <KoyaAvatar state={isComplete ? "celebrating" : "learning"} size="lg" />
        <div>
          <h3 className="font-semibold text-lg">
            {isComplete ? "All set!" : "Koya is learning..."}
          </h3>
          <p className="text-sm text-muted-foreground">
            {isComplete
              ? `Ready to handle ${businessType} calls`
              : `About ${businessType} businesses`}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-muted rounded-full mb-6 overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary via-purple-500 to-emerald-500"
          initial={{ width: "0%" }}
          animate={{
            width: `${((currentIndex + (items[currentIndex]?.complete ? 1 : 0.5)) / items.length) * 100}%`,
          }}
          transition={{ duration: 0.5 }}
        />
      </div>

      {/* Learning items */}
      <div className="space-y-3">
        <AnimatePresence mode="popLayout">
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{
                opacity: index <= currentIndex ? 1 : 0.4,
                x: 0,
              }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                "flex items-center gap-3 p-3 rounded-lg transition-colors",
                index === currentIndex && !item.complete && "bg-primary/5",
                item.complete && "bg-emerald-500/5"
              )}
            >
              {/* Icon */}
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors",
                  item.complete
                    ? "bg-emerald-500 text-white"
                    : index === currentIndex
                    ? "bg-primary/20 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {item.complete ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 500 }}
                  >
                    <Check className="w-4 h-4" />
                  </motion.div>
                ) : index === currentIndex ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <item.icon className="w-4 h-4" />
                  </motion.div>
                ) : (
                  <item.icon className="w-4 h-4" />
                )}
              </div>

              {/* Text */}
              <span
                className={cn(
                  "text-sm flex-1",
                  item.complete && "text-emerald-600 dark:text-emerald-400",
                  index === currentIndex && !item.complete && "text-foreground",
                  index > currentIndex && "text-muted-foreground"
                )}
              >
                {item.complete
                  ? item.text.replace("...", "").replace("Loading", "Loaded").replace("Adding", "Added").replace("Configuring", "Configured").replace("Optimizing", "Optimized").replace("Scanning", "Scanned")
                  : item.text}
              </span>

              {/* Loading dots for current item */}
              {index === currentIndex && !item.complete && (
                <div className="flex gap-0.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-1.5 h-1.5 bg-primary rounded-full"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{
                        duration: 1,
                        repeat: Infinity,
                        delay: i * 0.2,
                      }}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Completion message */}
      <AnimatePresence>
        {isComplete && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-6 pt-6 border-t border-border"
          >
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="w-5 h-5" />
              <span className="font-medium">
                Koya is customized for {businessType}!
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              You can review and adjust everything in the next step.
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Mini version for inline use
export function LearningIndicator({ text }: { text: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex items-center gap-2 text-sm text-muted-foreground"
    >
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      >
        <Brain className="w-4 h-4 text-primary" />
      </motion.div>
      <span>{text}</span>
    </motion.div>
  );
}
