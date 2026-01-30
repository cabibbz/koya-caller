"use client";

/**
 * Animated Progress Path
 * Visual journey through onboarding phases
 */

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Building2, Sparkles, Phone, PhoneCall, Check } from "lucide-react";

export type OnboardingPhase = 1 | 2 | 3 | 4;

interface ProgressPathProps {
  currentPhase: OnboardingPhase;
  className?: string;
}

const phases = [
  { id: 1, label: "Tell", icon: Building2, description: "About your business" },
  { id: 2, label: "Tune", icon: Sparkles, description: "Customize Koya" },
  { id: 3, label: "Phone", icon: Phone, description: "Get your number" },
  { id: 4, label: "Test", icon: PhoneCall, description: "Go live" },
];

export function ProgressPath({ currentPhase, className }: ProgressPathProps) {
  return (
    <div className={cn("w-full", className)}>
      {/* Desktop version */}
      <div className="hidden sm:block">
        <div className="relative flex items-center justify-between max-w-md mx-auto">
          {/* Progress line background */}
          <div className="absolute left-0 right-0 top-1/2 h-1 bg-border -translate-y-1/2 rounded-full" />

          {/* Animated progress fill */}
          <motion.div
            className="absolute left-0 top-1/2 h-1 bg-gradient-to-r from-primary via-primary to-emerald-500 -translate-y-1/2 rounded-full"
            initial={{ width: "0%" }}
            animate={{
              width:
                currentPhase === 1
                  ? "0%"
                  : currentPhase === 2
                  ? "33%"
                  : currentPhase === 3
                  ? "66%"
                  : "100%",
            }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />

          {/* Phase nodes */}
          {phases.map((phase) => {
            const isComplete = currentPhase > phase.id;
            const isActive = currentPhase === phase.id;
            const isPending = currentPhase < phase.id;

            return (
              <div key={phase.id} className="relative z-10 flex flex-col items-center">
                <motion.div
                  className={cn(
                    "w-12 h-12 rounded-full flex items-center justify-center transition-colors",
                    "border-2 shadow-lg",
                    isComplete && "bg-emerald-500 border-emerald-500",
                    isActive && "bg-primary border-primary",
                    isPending && "bg-card border-border"
                  )}
                  animate={{
                    scale: isActive ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    duration: 2,
                    repeat: isActive ? Infinity : 0,
                    ease: "easeInOut",
                  }}
                >
                  {isComplete ? (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    >
                      <Check className="w-5 h-5 text-white" />
                    </motion.div>
                  ) : (
                    <phase.icon
                      className={cn(
                        "w-5 h-5",
                        isActive && "text-white",
                        isPending && "text-muted-foreground"
                      )}
                    />
                  )}
                </motion.div>

                {/* Label */}
                <motion.div
                  className="mt-3 text-center"
                  animate={{
                    opacity: isActive ? 1 : 0.6,
                  }}
                >
                  <p
                    className={cn(
                      "font-semibold text-sm",
                      isActive && "text-primary",
                      isComplete && "text-emerald-500"
                    )}
                  >
                    {phase.label}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {phase.description}
                  </p>
                </motion.div>

                {/* Active indicator glow */}
                {isActive && (
                  <motion.div
                    className="absolute -inset-2 rounded-full bg-primary/20 -z-10"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile version - compact */}
      <div className="sm:hidden">
        <div className="flex items-center justify-center gap-2">
          {phases.map((phase, index) => {
            const isComplete = currentPhase > phase.id;
            const isActive = currentPhase === phase.id;

            return (
              <div key={phase.id} className="flex items-center">
                <motion.div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold",
                    isComplete && "bg-emerald-500 text-white",
                    isActive && "bg-primary text-white",
                    !isComplete && !isActive && "bg-muted text-muted-foreground"
                  )}
                  animate={{
                    scale: isActive ? [1, 1.1, 1] : 1,
                  }}
                  transition={{
                    duration: 1.5,
                    repeat: isActive ? Infinity : 0,
                  }}
                >
                  {isComplete ? <Check className="w-4 h-4" /> : phase.id}
                </motion.div>

                {index < phases.length - 1 && (
                  <motion.div
                    className={cn(
                      "w-8 h-0.5 mx-1",
                      currentPhase > phase.id ? "bg-emerald-500" : "bg-border"
                    )}
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: index * 0.2 }}
                  />
                )}
              </div>
            );
          })}
        </div>

        {/* Current phase label */}
        <motion.p
          key={currentPhase}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mt-3 text-sm font-medium"
        >
          {phases[currentPhase - 1].label}: {phases[currentPhase - 1].description}
        </motion.p>
      </div>
    </div>
  );
}

// Celebration animation for completion
export function CompletionCelebration() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-8"
    >
      <motion.div
        animate={{
          rotate: [0, -10, 10, -10, 0],
          scale: [1, 1.1, 1],
        }}
        transition={{ duration: 0.5, repeat: 3 }}
        className="text-6xl mb-4"
      >
        🎉
      </motion.div>
      <h2 className="text-2xl font-bold text-foreground mb-2">
        You&apos;re all set!
      </h2>
      <p className="text-muted-foreground">
        Koya is ready to take your calls
      </p>

      {/* Confetti particles */}
      <div className="relative h-20 overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              background: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4"][i % 5],
              left: `${10 + Math.random() * 80}%`,
            }}
            initial={{ y: -20, opacity: 1 }}
            animate={{
              y: 100,
              opacity: 0,
              rotate: Math.random() * 360,
            }}
            transition={{
              duration: 1 + Math.random(),
              delay: Math.random() * 0.5,
              repeat: 2,
            }}
          />
        ))}
      </div>
    </motion.div>
  );
}
