"use client";

/**
 * Voice Preview Widget
 * Interactive widget to let visitors hear Koya's different voices
 */

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, Volume2, Sparkles, User, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Voice {
  id: string;
  name: string;
  gender: "male" | "female";
  style: string;
  styleDescription: string;
  previewUrl: string;
  greeting: string;
}

const voices: Voice[] = [
  {
    id: "rachel-warm",
    name: "Rachel",
    gender: "female",
    style: "Warm",
    styleDescription: "Friendly and approachable",
    previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/rachel.mp3",
    greeting: "Thanks for calling, this is Koya. How can I help you today?",
  },
  {
    id: "sarah-professional",
    name: "Sarah",
    gender: "female",
    style: "Professional",
    styleDescription: "Clear and businesslike",
    previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/sarah.mp3",
    greeting: "Thanks for calling, this is Koya. How can I help you today?",
  },
  {
    id: "adrian-professional",
    name: "Adrian",
    gender: "male",
    style: "Professional",
    styleDescription: "Clear and businesslike",
    previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/adrian.mp3",
    greeting: "Thanks for calling, this is Koya. How can I help you today?",
  },
  {
    id: "marcus-warm",
    name: "Marcus",
    gender: "male",
    style: "Warm",
    styleDescription: "Friendly and approachable",
    previewUrl: "https://retell-utils-public.s3.us-west-2.amazonaws.com/marcus.mp3",
    greeting: "Thanks for calling, this is Koya. How can I help you today?",
  },
];

function VoiceWaveform({ isPlaying }: { isPlaying: boolean }) {
  return (
    <div className="flex items-center justify-center gap-1 h-12">
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1 bg-gradient-to-t from-purple-500 to-cyan-400 rounded-full"
          animate={
            isPlaying
              ? {
                  height: [12, 32, 20, 40, 16],
                  transition: {
                    duration: 0.8,
                    repeat: Infinity,
                    repeatType: "reverse",
                    delay: i * 0.1,
                  },
                }
              : { height: 12 }
          }
        />
      ))}
    </div>
  );
}

function VoiceCard({
  voice,
  isActive,
  isPlaying,
  onPlay,
  onSelect,
}: {
  voice: Voice;
  isActive: boolean;
  isPlaying: boolean;
  onPlay: () => void;
  onSelect: () => void;
}) {
  return (
    <motion.div
      layout
      onClick={onSelect}
      className={`relative cursor-pointer rounded-xl p-3 transition-all ${
        isActive
          ? "glass border-2 border-purple-500/50"
          : "bg-white/5 hover:bg-white/10 border-2 border-transparent"
      }`}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Active indicator */}
      {isActive && (
        <motion.div
          layoutId="activeVoice"
          className="absolute inset-0 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-500/20"
          initial={false}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        />
      )}

      <div className="relative z-10 flex flex-col items-center gap-2 text-center">
        {/* Avatar */}
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
            voice.gender === "female"
              ? "bg-gradient-to-br from-pink-500 to-purple-500"
              : "bg-gradient-to-br from-blue-500 to-cyan-500"
          }`}
        >
          {isActive && isPlaying ? (
            <Pause className="w-4 h-4 text-white" />
          ) : (
            <User className="w-5 h-5 text-white" />
          )}
        </div>

        {/* Info */}
        <div className="min-w-0">
          <span className="font-medium text-white text-sm block truncate">{voice.name}</span>
          <span className="text-xs text-zinc-400 block">{voice.style}</span>
        </div>

        {/* Play indicator for active card */}
        {isActive && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              onPlay();
            }}
            className={`text-xs px-3 py-1 rounded-full transition-colors ${
              isPlaying
                ? "bg-purple-500 text-white"
                : "bg-white/10 text-white hover:bg-white/20"
            }`}
          >
            {isPlaying ? "Pause" : "Play"}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function VoicePreviewWidget() {
  const [selectedVoice, setSelectedVoice] = useState(voices[0]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Create audio element
    audioRef.current = new Audio();
    audioRef.current.addEventListener("ended", () => {
      setIsPlaying(false);
      setProgress(0);
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    };
  }, []);

  const handlePlay = () => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    } else {
      audioRef.current.src = selectedVoice.previewUrl;
      audioRef.current.play().catch(() => {});
      setIsPlaying(true);

      // Update progress
      progressIntervalRef.current = setInterval(() => {
        if (audioRef.current) {
          const percent =
            (audioRef.current.currentTime / audioRef.current.duration) * 100;
          setProgress(isNaN(percent) ? 0 : percent);
        }
      }, 100);
    }
  };

  const handleSelectVoice = (voice: Voice) => {
    if (isPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
      setProgress(0);
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
      }
    }
    setSelectedVoice(voice);
  };

  const currentIndex = voices.findIndex((v) => v.id === selectedVoice.id);

  const goToPrev = () => {
    const prevIndex = currentIndex === 0 ? voices.length - 1 : currentIndex - 1;
    handleSelectVoice(voices[prevIndex]);
  };

  const goToNext = () => {
    const nextIndex = currentIndex === voices.length - 1 ? 0 : currentIndex + 1;
    handleSelectVoice(voices[nextIndex]);
  };

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/3 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
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
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/20 text-purple-400 text-sm mb-6"
          >
            <Volume2 className="w-4 h-4" />
            Try it yourself
          </motion.div>
          <h2 className="text-3xl md:text-5xl font-bold text-white mb-4">
            Hear{" "}
            <span className="text-transparent bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text">
              Koya&apos;s Voice
            </span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Choose from multiple voice personalities to match your brand. Each voice is natural,
            professional, and available 24/7.
          </p>
        </motion.div>

        {/* Main Widget */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-6 md:p-8"
        >
          {/* Now Playing Section */}
          <div className="flex flex-col md:flex-row items-center gap-6 mb-8 pb-8 border-b border-white/10">
            {/* Voice Avatar */}
            <motion.div
              key={selectedVoice.id}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`w-24 h-24 rounded-2xl flex items-center justify-center ${
                selectedVoice.gender === "female"
                  ? "bg-gradient-to-br from-pink-500 to-purple-500"
                  : "bg-gradient-to-br from-blue-500 to-cyan-500"
              }`}
            >
              {isPlaying ? (
                <VoiceWaveform isPlaying={isPlaying} />
              ) : (
                <User className="w-12 h-12 text-white" />
              )}
            </motion.div>

            {/* Voice Info & Controls */}
            <div className="flex-1 text-center md:text-left">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedVoice.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                >
                  <h3 className="text-2xl font-bold text-white mb-1">
                    {selectedVoice.name}
                  </h3>
                  <p className="text-zinc-400 mb-3">
                    {selectedVoice.style} &middot; {selectedVoice.styleDescription}
                  </p>
                </motion.div>
              </AnimatePresence>

              {/* Progress bar */}
              <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>

            {/* Play Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handlePlay}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isPlaying
                  ? "bg-gradient-to-r from-purple-500 to-cyan-500 shadow-lg shadow-purple-500/25"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              {isPlaying ? (
                <Pause className="w-7 h-7 text-white" />
              ) : (
                <Play className="w-7 h-7 text-white ml-1" />
              )}
            </motion.button>
          </div>

          {/* Voice Selection */}
          <div className="flex items-center gap-4">
            <button
              onClick={goToPrev}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
              {voices.map((voice) => (
                <VoiceCard
                  key={voice.id}
                  voice={voice}
                  isActive={selectedVoice.id === voice.id}
                  isPlaying={isPlaying && selectedVoice.id === voice.id}
                  onPlay={handlePlay}
                  onSelect={() => handleSelectVoice(voice)}
                />
              ))}
            </div>

            <button
              onClick={goToNext}
              className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>

          {/* CTA */}
          <div className="mt-8 text-center">
            <p className="text-zinc-400 mb-4">
              <Sparkles className="w-4 h-4 inline mr-1" />
              All voices support natural conversation and can be customized to your business
            </p>
            <Button
              size="lg"
              className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white border-0"
              asChild
            >
              <a href="/signup">Try Koya Free for 14 Days</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
