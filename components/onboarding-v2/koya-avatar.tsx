"use client";

/**
 * Koya Avatar Component
 * Animated avatar that represents Koya during onboarding
 */

import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type KoyaState = "idle" | "thinking" | "talking" | "celebrating" | "learning";

interface KoyaAvatarProps {
  state?: KoyaState;
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function KoyaAvatar({
  state = "idle",
  size = "md",
  className,
}: KoyaAvatarProps) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const innerSize = {
    sm: "w-6 h-6",
    md: "w-8 h-8",
    lg: "w-12 h-12",
  };

  return (
    <div className={cn("relative", sizeClasses[size], className)}>
      {/* Outer glow ring */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-full",
          state === "thinking" && "bg-primary/20",
          state === "talking" && "bg-emerald-500/20",
          state === "celebrating" && "bg-amber-500/20",
          state === "learning" && "bg-purple-500/20",
          state === "idle" && "bg-primary/10"
        )}
        animate={{
          scale: state === "idle" ? [1, 1.1, 1] : state === "thinking" ? [1, 1.2, 1] : 1,
          opacity: state === "celebrating" ? [0.5, 1, 0.5] : 1,
        }}
        transition={{
          duration: state === "thinking" ? 1.5 : 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />

      {/* Main avatar circle */}
      <motion.div
        className={cn(
          "absolute inset-1 rounded-full flex items-center justify-center",
          "bg-gradient-to-br shadow-lg",
          state === "thinking" && "from-primary to-primary/80",
          state === "talking" && "from-emerald-500 to-emerald-600",
          state === "celebrating" && "from-amber-500 to-orange-500",
          state === "learning" && "from-purple-500 to-purple-600",
          state === "idle" && "from-primary to-primary/80"
        )}
        animate={{
          rotate: state === "celebrating" ? [0, -5, 5, -5, 0] : 0,
        }}
        transition={{
          duration: 0.5,
          repeat: state === "celebrating" ? Infinity : 0,
        }}
      >
        {/* Inner icon/face */}
        <div className={cn("relative", innerSize[size])}>
          <AnimatePresence mode="wait">
            {state === "thinking" && (
              <motion.div
                key="thinking"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <ThinkingDots />
              </motion.div>
            )}
            {state === "talking" && (
              <motion.div
                key="talking"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <SoundWaves />
              </motion.div>
            )}
            {state === "learning" && (
              <motion.div
                key="learning"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <LearningBrain />
              </motion.div>
            )}
            {state === "celebrating" && (
              <motion.div
                key="celebrating"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center text-white text-2xl"
              >
                ✨
              </motion.div>
            )}
            {state === "idle" && (
              <motion.div
                key="idle"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                className="absolute inset-0 flex items-center justify-center"
              >
                <KoyaFace />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Celebration particles */}
      {state === "celebrating" && <CelebrationParticles />}
    </div>
  );
}

function ThinkingDots() {
  return (
    <div className="flex gap-1">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="w-1.5 h-1.5 bg-white rounded-full"
          animate={{ y: [-2, 2, -2] }}
          transition={{
            duration: 0.6,
            repeat: Infinity,
            delay: i * 0.2,
          }}
        />
      ))}
    </div>
  );
}

function SoundWaves() {
  return (
    <div className="flex items-center gap-0.5">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="w-1 bg-white rounded-full"
          animate={{ height: [4, 12, 4] }}
          transition={{
            duration: 0.4,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </div>
  );
}

function LearningBrain() {
  return (
    <motion.div
      animate={{ rotate: 360 }}
      transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        className="w-6 h-6"
      >
        <circle cx="12" cy="12" r="3" />
        <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
      </svg>
    </motion.div>
  );
}

function KoyaFace() {
  return (
    <div className="flex flex-col items-center gap-1">
      {/* Eyes */}
      <div className="flex gap-2">
        <motion.div
          className="w-1.5 h-1.5 bg-white rounded-full"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />
        <motion.div
          className="w-1.5 h-1.5 bg-white rounded-full"
          animate={{ scaleY: [1, 0.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
        />
      </div>
      {/* Smile */}
      <div className="w-3 h-1.5 border-b-2 border-white rounded-b-full" />
    </div>
  );
}

function CelebrationParticles() {
  const particles = Array.from({ length: 8 });

  return (
    <>
      {particles.map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-2 h-2 rounded-full"
          style={{
            background: ["#FFD700", "#FF6B6B", "#4ECDC4", "#45B7D1"][i % 4],
            left: "50%",
            top: "50%",
          }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{
            x: Math.cos((i * Math.PI) / 4) * 40,
            y: Math.sin((i * Math.PI) / 4) * 40,
            opacity: 0,
            scale: 0,
          }}
          transition={{
            duration: 1,
            repeat: Infinity,
            delay: i * 0.1,
          }}
        />
      ))}
    </>
  );
}
