"use client";

/**
 * Phone Preview Component
 * Shows a live preview of how Koya will sound/respond
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Volume2, VolumeX, Phone, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";

interface PhonePreviewProps {
  businessName?: string;
  greeting?: string;
  voiceName?: string;
  isActive?: boolean;
  className?: string;
}

export function PhonePreview({
  businessName = "Your Business",
  greeting,
  voiceName = "Koya",
  isActive = true,
  className,
}: PhonePreviewProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentText, setCurrentText] = useState("");
  const [showWaveform, setShowWaveform] = useState(false);

  const defaultGreeting = `Hi, thanks for calling ${businessName}. This is ${voiceName}, how can I help you today?`;
  const displayGreeting = greeting || defaultGreeting;

  // Simulate typing effect when greeting changes
  useEffect(() => {
    if (!isActive) return;

    setCurrentText("");
    let index = 0;
    const interval = setInterval(() => {
      if (index <= displayGreeting.length) {
        setCurrentText(displayGreeting.slice(0, index));
        index++;
      } else {
        clearInterval(interval);
      }
    }, 30);

    return () => clearInterval(interval);
  }, [displayGreeting, isActive]);

  const handlePlay = () => {
    setIsPlaying(true);
    setShowWaveform(true);
    // Simulate audio playing
    setTimeout(() => {
      setIsPlaying(false);
      setShowWaveform(false);
    }, 3000);
  };

  return (
    <div
      className={cn(
        "relative bg-gradient-to-b from-slate-900 to-slate-800 rounded-[2.5rem] p-2 shadow-2xl",
        className
      )}
    >
      {/* Phone frame */}
      <div className="relative bg-black rounded-[2rem] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-black rounded-b-2xl z-10" />

        {/* Screen content */}
        <div className="bg-gradient-to-b from-slate-950 to-slate-900 min-h-[400px] px-4 py-8">
          {/* Status bar */}
          <div className="flex justify-between items-center text-white/60 text-xs px-2 mb-6">
            <span>9:41</span>
            <div className="flex gap-1 items-center">
              <div className="w-4 h-2 border border-white/60 rounded-sm">
                <div className="w-2/3 h-full bg-white/60 rounded-sm" />
              </div>
            </div>
          </div>

          {/* Call UI */}
          <div className="flex flex-col items-center gap-4">
            {/* Caller info */}
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-center"
            >
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center mb-3 mx-auto">
                <Phone className="w-8 h-8 text-white" />
              </div>
              <p className="text-white font-medium">{businessName}</p>
              <p className="text-white/60 text-sm">Incoming Call</p>
            </motion.div>

            {/* Waveform visualization */}
            <AnimatePresence>
              {showWaveform && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  className="flex items-center justify-center gap-1 h-12"
                >
                  {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                      key={i}
                      className="w-1 bg-primary rounded-full"
                      animate={{
                        height: [8, 24 + Math.random() * 16, 8],
                      }}
                      transition={{
                        duration: 0.3 + Math.random() * 0.2,
                        repeat: Infinity,
                        delay: i * 0.05,
                      }}
                    />
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Speech bubble */}
            <motion.div
              layout
              className="bg-white/10 backdrop-blur-sm rounded-2xl p-4 mx-2 min-h-[80px]"
            >
              <p className="text-white/90 text-sm leading-relaxed">
                {currentText}
                <motion.span
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                  className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle"
                />
              </p>
            </motion.div>

            {/* Preview label */}
            <div className="flex items-center gap-2 text-white/40 text-xs">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Preview</span>
            </div>
          </div>

          {/* Bottom controls */}
          <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-4">
            <Button
              size="icon"
              variant="outline"
              className="w-12 h-12 rounded-full bg-white/10 border-white/20 hover:bg-white/20"
              onClick={handlePlay}
              disabled={isPlaying}
            >
              {isPlaying ? (
                <VolumeX className="w-5 h-5 text-white" />
              ) : (
                <Volume2 className="w-5 h-5 text-white" />
              )}
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="w-12 h-12 rounded-full bg-white/10 border-white/20 hover:bg-white/20"
            >
              <Mic className="w-5 h-5 text-white" />
            </Button>
          </div>
        </div>
      </div>

      {/* Home indicator */}
      <div className="flex justify-center mt-2">
        <div className="w-32 h-1 bg-white/20 rounded-full" />
      </div>
    </div>
  );
}

// Compact version for inline display
export function PhonePreviewMini({
  greeting,
  className,
}: {
  greeting: string;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "bg-slate-900 rounded-xl p-3 border border-slate-700",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Volume2 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white/80 text-sm leading-relaxed">{greeting}</p>
          <p className="text-white/40 text-xs mt-1">Tap to preview</p>
        </div>
      </div>
    </motion.div>
  );
}
