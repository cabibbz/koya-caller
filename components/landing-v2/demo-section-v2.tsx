"use client";

/**
 * Demo Section V2
 * Glassmorphism design with animated Koya avatar
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  MessageSquare,
  Calendar,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
  ArrowRight,
  Volume2,
  CheckCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";

type CallState = "idle" | "connecting" | "active" | "ended" | "error";

// Animated audio bars component
function AudioVisualizer({ isActive }: { isActive: boolean }) {
  return (
    <div className="flex justify-center items-end gap-1 h-16">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="w-1.5 bg-gradient-to-t from-purple-500 to-cyan-500 rounded-full"
          animate={
            isActive
              ? {
                  height: [16, 40 + Math.random() * 24, 16],
                }
              : { height: 16 }
          }
          transition={{
            duration: 0.5,
            repeat: isActive ? Infinity : 0,
            delay: i * 0.05,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

// Koya avatar for demo
function DemoKoyaAvatar({
  state,
}: {
  state: "idle" | "talking" | "listening";
}) {
  return (
    <motion.div
      className="relative w-24 h-24"
      animate={{ scale: state === "talking" ? [1, 1.05, 1] : 1 }}
      transition={{ duration: 0.5, repeat: state === "talking" ? Infinity : 0 }}
    >
      {/* Glow */}
      <motion.div
        className="absolute inset-0 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 blur-xl"
        animate={{
          opacity: state === "talking" ? [0.5, 0.8, 0.5] : 0.3,
          scale: state === "talking" ? [1, 1.2, 1] : 1,
        }}
        transition={{ duration: 1, repeat: Infinity }}
      />

      {/* Face */}
      <div className="relative w-full h-full rounded-full bg-gradient-to-br from-purple-500 via-violet-500 to-cyan-500 p-1">
        <div className="w-full h-full rounded-full bg-gradient-to-b from-zinc-900 to-black flex items-center justify-center relative overflow-hidden">
          {/* Eyes */}
          <div className="flex gap-4 absolute top-1/3">
            <motion.div
              className="w-3 h-3 rounded-full bg-white"
              animate={{
                scaleY: state === "talking" ? [1, 0.5, 1] : 1,
              }}
              transition={{
                duration: 0.3,
                repeat: state === "talking" ? Infinity : 0,
              }}
            />
            <motion.div
              className="w-3 h-3 rounded-full bg-white"
              animate={{
                scaleY: state === "talking" ? [1, 0.5, 1] : 1,
              }}
              transition={{
                duration: 0.3,
                repeat: state === "talking" ? Infinity : 0,
                delay: 0.1,
              }}
            />
          </div>

          {/* Mouth */}
          <motion.div
            className="absolute bottom-1/3"
            animate={{
              scaleY: state === "talking" ? [1, 1.5, 0.8, 1] : 1,
            }}
            transition={{
              duration: 0.3,
              repeat: state === "talking" ? Infinity : 0,
            }}
          >
            {state === "talking" ? (
              <div className="w-5 h-3 rounded-full bg-white" />
            ) : (
              <div className="w-5 h-1.5 rounded-full bg-white" />
            )}
          </motion.div>

          {/* Sound waves when talking */}
          {state === "talking" && (
            <div className="absolute -right-2 top-1/2 -translate-y-1/2 flex gap-0.5">
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-0.5 bg-cyan-400 rounded-full"
                  animate={{ height: [6, 14, 6], opacity: [0.5, 1, 0.5] }}
                  transition={{
                    duration: 0.4,
                    repeat: Infinity,
                    delay: i * 0.1,
                  }}
                />
              ))}
            </div>
          )}

          {/* Listening indicator */}
          {state === "listening" && (
            <motion.div
              className="absolute -bottom-1 left-1/2 -translate-x-1/2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <div className="flex gap-1">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-1.5 h-1.5 bg-emerald-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{
                      duration: 0.8,
                      repeat: Infinity,
                      delay: i * 0.2,
                    }}
                  />
                ))}
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export function DemoSectionV2() {
  const [email, setEmail] = useState("");
  const [language, setLanguage] = useState<"en" | "es">("en");
  const [hasSubmittedEmail, setHasSubmittedEmail] = useState(false);
  const [callState, setCallState] = useState<CallState>("idle");
  const [callStatus, setCallStatus] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [rateLimited, setRateLimited] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [koyaState, setKoyaState] = useState<"idle" | "talking" | "listening">(
    "idle"
  );

  const retellClientRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
        } catch (_e) {}
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (email) {
      setHasSubmittedEmail(true);
      setError(null);
    }
  };

  const handleStartCall = useCallback(async () => {
    setCallState("connecting");
    setError(null);
    setCallStatus("Requesting microphone access...");

    try {
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_micError) {
        throw new Error(
          "Microphone access denied. Please allow microphone access to talk to Koya."
        );
      }

      setCallStatus("Connecting to Koya...");

      const response = await fetch("/api/demo/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, language }),
      });

      const data = await response.json();

      if (data.rateLimited) {
        setRateLimited(true);
        setError(data.error || "Demo limit reached. Sign up for unlimited access!");
        setCallState("error");
        return;
      }

      if (data.mock) {
        setError(data.error || "Demo not available in development mode.");
        setCallState("error");
        return;
      }

      if (!data.success || !data.accessToken) {
        throw new Error(data.error || "Failed to start call");
      }

      setCallStatus("Starting call...");

      const { RetellWebClient } = await import("retell-client-js-sdk");
      const retellClient = new RetellWebClient();
      retellClientRef.current = retellClient;

      retellClient.on("call_started", () => {
        setCallState("active");
        setCallStatus("Connected! Say hello to Koya.");
        setKoyaState("talking");
        durationIntervalRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1);
        }, 1000);
      });

      retellClient.on("call_ended", () => {
        setCallState("ended");
        setCallStatus("Call ended");
        setKoyaState("idle");
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      });

      retellClient.on("error", (err: any) => {
        setError(`Call error: ${err.message || err}`);
        setCallState("error");
        setKoyaState("idle");
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current);
        }
      });

      retellClient.on("agent_start_talking", () => {
        setCallStatus("Koya is speaking...");
        setKoyaState("talking");
      });

      retellClient.on("agent_stop_talking", () => {
        setCallStatus("Your turn to speak...");
        setKoyaState("listening");
      });

      await retellClient.startCall({
        accessToken: data.accessToken,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call");
      setCallState("error");
    }
  }, [email, language]);

  const handleEndCall = useCallback(() => {
    if (retellClientRef.current) {
      try {
        retellClientRef.current.stopCall();
      } catch (_e) {
        // Error handled silently
      }
    }
    setCallState("ended");
    setCallStatus("Call ended");
    setKoyaState("idle");
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
    }
  }, []);

  const handleToggleMute = useCallback(() => {
    if (retellClientRef.current) {
      try {
        if (isMuted) {
          retellClientRef.current.unmute();
        } else {
          retellClientRef.current.mute();
        }
        setIsMuted(!isMuted);
      } catch (_e) {
        // Error handled silently
      }
    }
  }, [isMuted]);

  const handleRestart = useCallback(() => {
    setCallState("idle");
    setCallStatus("");
    setCallDuration(0);
    setError(null);
    setKoyaState("idle");
  }, []);

  const features = [
    { icon: Phone, text: "Natural conversation", color: "from-purple-500 to-violet-600" },
    { icon: MessageSquare, text: "Answers questions", color: "from-cyan-500 to-blue-600" },
    { icon: Calendar, text: "Books appointments", color: "from-pink-500 to-rose-600" },
    { icon: Volume2, text: "Bilingual support", color: "from-amber-500 to-orange-600" },
  ];

  return (
    <section id="demo" className="py-24 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
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
            className="inline-flex items-center gap-2 glass rounded-full px-4 py-2 mb-6"
          >
            <Phone className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-zinc-300">Live demo</span>
          </motion.div>

          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-white">Talk to </span>
            <span className="text-shimmer">Koya</span>
          </h2>
          <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
            Experience our AI receptionist firsthand. Have a real conversation and
            see what Koya can do for your business.
          </p>
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          {/* Left - Demo Card */}
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
          >
            <div className="glass rounded-2xl overflow-hidden">
              {/* Header */}
              <div className="bg-gradient-to-r from-purple-500/10 to-cyan-500/10 px-6 py-4 border-b border-white/5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-cyan-500 flex items-center justify-center">
                      <Phone className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">Demo Koya</h3>
                      <p className="text-sm text-zinc-400">AI Receptionist</p>
                    </div>
                  </div>

                  {/* Language Toggle */}
                  {hasSubmittedEmail && callState === "idle" && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="flex items-center gap-2"
                    >
                      <Globe className="w-4 h-4 text-zinc-500" />
                      <div className="flex rounded-lg overflow-hidden glass-light">
                        <button
                          onClick={() => setLanguage("en")}
                          className={cn(
                            "px-3 py-1.5 text-sm transition-all",
                            language === "en"
                              ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
                              : "text-zinc-400 hover:text-white"
                          )}
                        >
                          EN
                        </button>
                        <button
                          onClick={() => setLanguage("es")}
                          className={cn(
                            "px-3 py-1.5 text-sm transition-all",
                            language === "es"
                              ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white"
                              : "text-zinc-400 hover:text-white"
                          )}
                        >
                          ES
                        </button>
                      </div>
                    </motion.div>
                  )}
                </div>
              </div>

              {/* Content */}
              <div className="p-8">
                <AnimatePresence mode="wait">
                  {!hasSubmittedEmail ? (
                    <motion.form
                      key="email-form"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      onSubmit={handleEmailSubmit}
                      className="space-y-4"
                    >
                      <div className="text-center mb-6">
                        <DemoKoyaAvatar state="idle" />
                        <p className="text-zinc-400 mt-4">
                          Enter your email to talk to Koya
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3">
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.com"
                          className="flex-1 px-4 py-3 glass-light rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-purple-500/50 transition-colors"
                          required
                        />
                        <Button
                          type="submit"
                          className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                        >
                          Start Demo
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                      </div>

                      <p className="text-xs text-center text-zinc-500">
                        By continuing, you agree to receive updates about Koya.
                      </p>
                    </motion.form>
                  ) : callState === "idle" ? (
                    <motion.div
                      key="ready"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-center space-y-6"
                    >
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm text-emerald-400">Ready to connect</span>
                      </div>

                      <DemoKoyaAvatar state="idle" />

                      <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={handleStartCall}
                        className="w-20 h-20 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 flex items-center justify-center mx-auto shadow-lg shadow-purple-500/30"
                      >
                        <Phone className="w-8 h-8 text-white" />
                      </motion.button>

                      <p className="text-zinc-400">
                        Click to call Koya {language === "es" ? "(en Español)" : ""}
                      </p>
                    </motion.div>
                  ) : callState === "connecting" ? (
                    <motion.div
                      key="connecting"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-center space-y-6 py-8"
                    >
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      >
                        <Loader2 className="w-12 h-12 mx-auto text-purple-500" />
                      </motion.div>
                      <div>
                        <p className="font-medium text-white">{callStatus}</p>
                        <p className="text-sm text-zinc-400 mt-1">
                          Please allow microphone access when prompted
                        </p>
                      </div>
                    </motion.div>
                  ) : callState === "active" ? (
                    <motion.div
                      key="active"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-center space-y-6"
                    >
                      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm text-emerald-400">{callStatus}</span>
                      </div>

                      <DemoKoyaAvatar state={koyaState} />

                      <p className="font-mono text-3xl font-bold text-white">
                        {formatDuration(callDuration)}
                      </p>

                      <AudioVisualizer isActive={koyaState === "talking"} />

                      <div className="flex justify-center gap-4">
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleToggleMute}
                          className={cn(
                            "w-14 h-14 rounded-full flex items-center justify-center transition-colors",
                            isMuted
                              ? "bg-red-500/20 border border-red-500/50"
                              : "glass border-white/20"
                          )}
                        >
                          {isMuted ? (
                            <MicOff className="w-6 h-6 text-red-500" />
                          ) : (
                            <Mic className="w-6 h-6 text-white" />
                          )}
                        </motion.button>

                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={handleEndCall}
                          className="w-14 h-14 rounded-full bg-red-500 flex items-center justify-center"
                        >
                          <PhoneOff className="w-6 h-6 text-white" />
                        </motion.button>
                      </div>
                    </motion.div>
                  ) : callState === "ended" ? (
                    <motion.div
                      key="ended"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-center space-y-6"
                    >
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: "spring" }}
                        className="w-20 h-20 mx-auto rounded-full bg-gradient-to-r from-purple-500/20 to-cyan-500/20 flex items-center justify-center"
                      >
                        <CheckCircle className="w-10 h-10 text-emerald-400" />
                      </motion.div>

                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          Thanks for talking to Koya!
                        </h3>
                        <p className="text-zinc-400 mt-2">
                          Call lasted {formatDuration(callDuration)}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Button
                          variant="outline"
                          onClick={handleRestart}
                          className="glass border-white/20"
                        >
                          <Phone className="w-4 h-4 mr-2" />
                          Call Again
                        </Button>
                        <Button
                          className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                          asChild
                        >
                          <Link href="/signup">
                            Get Started Free
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Link>
                        </Button>
                      </div>
                    </motion.div>
                  ) : callState === "error" ? (
                    <motion.div
                      key="error"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -20 }}
                      className="text-center space-y-6"
                    >
                      <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
                        <AlertCircle className="w-10 h-10 text-red-500" />
                      </div>

                      <div>
                        <h3 className="text-xl font-semibold text-white">
                          {rateLimited ? "Demo Limit Reached" : "Something went wrong"}
                        </h3>
                        <p className="text-zinc-400 mt-2">
                          {error || "Please try again later"}
                        </p>
                      </div>

                      <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        {!rateLimited && (
                          <Button
                            variant="outline"
                            onClick={handleRestart}
                            className="glass border-white/20"
                          >
                            Try Again
                          </Button>
                        )}
                        <Button
                          className="bg-gradient-to-r from-purple-500 to-cyan-500 text-white border-0"
                          asChild
                        >
                          <Link href="/signup">
                            {rateLimited ? "Sign Up for Unlimited" : "Get Started Free"}
                          </Link>
                        </Button>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </div>
            </div>
          </motion.div>

          {/* Right - Features & Chat Preview */}
          <motion.div
            initial={{ opacity: 0, x: 30 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            {/* What Koya Can Do */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-purple-400" />
                What Koya can do
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {features.map((feature, i) => (
                  <motion.div
                    key={feature.text}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.1 }}
                    className="glass-light rounded-xl p-4 group hover:border-white/20 transition-colors"
                  >
                    <div
                      className={`w-10 h-10 rounded-lg bg-gradient-to-br ${feature.color} flex items-center justify-center mb-3 group-hover:scale-110 transition-transform`}
                    >
                      <feature.icon className="w-5 h-5 text-white" />
                    </div>
                    <p className="text-sm text-zinc-300">{feature.text}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Sample Conversation */}
            <div className="glass rounded-2xl p-6">
              <h3 className="text-lg font-semibold text-white mb-4">
                Sample conversation
              </h3>
              <div className="space-y-3">
                {[
                  { from: "koya", text: "Hi, thanks for calling! How can I help you today?" },
                  { from: "user", text: "I'd like to book an appointment for next Tuesday" },
                  { from: "koya", text: "I'd be happy to help! I have openings at 10am, 2pm, and 4pm. Which works best for you?" },
                ].map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: msg.from === "user" ? 20 : -20 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.2 }}
                    className={`flex ${msg.from === "user" ? "justify-end" : "justify-start"}`}
                  >
                    <div
                      className={`max-w-[85%] px-4 py-3 rounded-2xl text-sm ${
                        msg.from === "user"
                          ? "bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-br-sm"
                          : "glass-light text-zinc-300 rounded-bl-sm"
                      }`}
                    >
                      {msg.text}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
