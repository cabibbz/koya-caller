"use client";

/**
 * Phase 3: Test - Go Live
 * Make a test call and complete onboarding
 * Uses Retell WebRTC for real browser-based test calls
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ProgressPath, KoyaAvatar, CompletionCelebration } from "@/components/onboarding-v2";
import { Phone, PhoneCall, CheckCircle, ArrowRight, Mic, MicOff, Volume2, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type TestStatus = "idle" | "connecting" | "calling" | "complete" | "error";

export function TestPageClient() {
  const router = useRouter();
  const [testStatus, setTestStatus] = useState<TestStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [businessId, setBusinessId] = useState<string | null>(null);
  const [callDuration, setCallDuration] = useState(0);
  const [isSkipping, setIsSkipping] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const retellClientRef = useRef<any>(null);
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Get business ID on mount
  useEffect(() => {
    async function fetchBusinessId() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: business } = await (supabase as any)
          .from("businesses")
          .select("id")
          .eq("user_id", user.id)
          .single();
        if (business) {
          setBusinessId(business.id);
        }
      }
    }
    fetchBusinessId();
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retellClientRef.current) {
        retellClientRef.current.stopCall();
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current);
      }
    };
  }, []);

  const startDurationTimer = useCallback(() => {
    setCallDuration(0);
    durationIntervalRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  }, []);

  const stopDurationTimer = useCallback(() => {
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current);
      durationIntervalRef.current = null;
    }
  }, []);

  const handleTestCall = async () => {
    setTestStatus("connecting");
    setError(null);

    try {
      // Request microphone permission first
      await navigator.mediaDevices.getUserMedia({ audio: true });

      // Get access token from our API
      const response = await fetch("/api/demo/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId }),
      });

      const data = await response.json();

      if (!data.success || !data.accessToken) {
        throw new Error(data.error || "Failed to start test call");
      }

      // Initialize Retell WebRTC client (dynamic import to avoid webpack issues)
      const { RetellWebClient } = await import("retell-client-js-sdk");
      const retellClient = new RetellWebClient();
      retellClientRef.current = retellClient;

      // Set up event handlers
      retellClient.on("call_started", () => {
        setTestStatus("calling");
        startDurationTimer();
      });

      retellClient.on("call_ended", () => {
        stopDurationTimer();
        setTestStatus("complete");
      });

      retellClient.on("error", () => {
        stopDurationTimer();
        setError("Call error occurred. Please try again.");
        setTestStatus("error");
      });

      // Start the call - don't specify captureDeviceId to use system default
      await retellClient.startCall({
        accessToken: data.accessToken,
        sampleRate: 24000,
      });

    } catch (err) {
      stopDurationTimer();
      setError(err instanceof Error ? err.message : "Failed to start call");
      setTestStatus("error");
    }
  };

  const handleEndCall = () => {
    if (retellClientRef.current) {
      retellClientRef.current.stopCall();
    }
    stopDurationTimer();
    setTestStatus("complete");
  };

  const toggleMute = () => {
    if (retellClientRef.current) {
      if (isMuted) {
        retellClientRef.current.unmute();
      } else {
        retellClientRef.current.mute();
      }
      setIsMuted(!isMuted);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleComplete = async (skip = false) => {
    // Mark onboarding complete and redirect to dashboard
    if (skip) {
      setIsSkipping(true);
    }
    try {
      await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skip }),
      });
      router.push("/dashboard");
    } catch {
      router.push("/dashboard");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ProgressPath currentPhase={4} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {testStatus === "complete" ? (
          <CompletionCelebration />
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="flex justify-center mb-4">
              <KoyaAvatar
                state={
                  testStatus === "calling"
                    ? "talking"
                    : testStatus === "connecting"
                    ? "thinking"
                    : "idle"
                }
                size="lg"
              />
            </div>
            <h1 className="text-2xl font-bold mb-2">
              {testStatus === "calling"
                ? "Speaking with Koya"
                : testStatus === "connecting"
                ? "Connecting..."
                : testStatus === "error"
                ? "Connection Failed"
                : "Test Your Koya"}
            </h1>
            <p className="text-muted-foreground">
              {testStatus === "calling"
                ? "Have a conversation with your AI receptionist"
                : testStatus === "connecting"
                ? "Setting up your test call..."
                : testStatus === "error"
                ? "Something went wrong. Please try again."
                : "Make a real call to hear Koya in action"}
            </p>
          </motion.div>
        )}

        {testStatus !== "complete" && (
          <>
            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4"
              >
                <Card className="border-destructive/50 bg-destructive/5">
                  <CardContent className="flex items-center gap-3 p-4">
                    <AlertCircle className="w-5 h-5 text-destructive" />
                    <p className="text-sm text-destructive">{error}</p>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* Test call card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <Card className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="bg-gradient-to-br from-primary to-primary/80 p-8 text-center text-white">
                    <motion.div
                      animate={
                        testStatus === "calling"
                          ? { scale: [1, 1.1, 1] }
                          : {}
                      }
                      transition={{ duration: 1, repeat: Infinity }}
                      className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-4"
                    >
                      {testStatus === "calling" ? (
                        <PhoneCall className="w-10 h-10" />
                      ) : testStatus === "connecting" ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                          <Phone className="w-10 h-10" />
                        </motion.div>
                      ) : (
                        <Phone className="w-10 h-10" />
                      )}
                    </motion.div>

                    {/* Call duration */}
                    {testStatus === "calling" && (
                      <p className="text-2xl font-mono mb-2">{formatDuration(callDuration)}</p>
                    )}

                    <p className="text-lg font-medium mb-1">
                      {testStatus === "calling"
                        ? "Call in progress"
                        : testStatus === "connecting"
                        ? "Connecting..."
                        : testStatus === "error"
                        ? "Connection failed"
                        : "Ready to test"}
                    </p>
                    <p className="text-white/80 text-sm">
                      {testStatus === "calling"
                        ? "Speak into your microphone to talk with Koya"
                        : testStatus === "connecting"
                        ? "Setting up your test call..."
                        : testStatus === "error"
                        ? "Please try again"
                        : "Click below to hear Koya answer"}
                    </p>
                  </div>

                  <div className="p-6 space-y-4">
                    {/* Active call controls */}
                    {testStatus === "calling" && (
                      <div className="flex items-center justify-center gap-4 mb-4">
                        <Button
                          variant="outline"
                          size="lg"
                          className="rounded-full w-14 h-14"
                          onClick={toggleMute}
                        >
                          {isMuted ? (
                            <MicOff className="w-6 h-6 text-muted-foreground" />
                          ) : (
                            <Mic className="w-6 h-6" />
                          )}
                        </Button>
                        <Button
                          variant="destructive"
                          size="lg"
                          className="rounded-full w-14 h-14"
                          onClick={handleEndCall}
                        >
                          <Phone className="w-6 h-6 rotate-[135deg]" />
                        </Button>
                        <Button
                          variant="outline"
                          size="lg"
                          className="rounded-full w-14 h-14"
                          disabled
                        >
                          <Volume2 className="w-6 h-6" />
                        </Button>
                      </div>
                    )}

                    {/* Start call button */}
                    {(testStatus === "idle" || testStatus === "error") && (
                      <Button
                        size="lg"
                        className="w-full gap-2"
                        onClick={handleTestCall}
                      >
                        <Phone className="w-4 h-4" />
                        {testStatus === "error" ? "Try Again" : "Make Test Call"}
                      </Button>
                    )}

                    {/* Connecting state */}
                    {testStatus === "connecting" && (
                      <Button size="lg" className="w-full gap-2" disabled>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        >
                          <PhoneCall className="w-4 h-4" />
                        </motion.div>
                        Connecting...
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Skip option */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.4 }}
              className="text-center"
            >
              <button
                onClick={() => handleComplete(true)}
                disabled={isSkipping}
                className="text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                {isSkipping ? "Redirecting to dashboard..." : "Skip for now, go to dashboard →"}
              </button>
            </motion.p>
          </>
        )}

        {testStatus === "complete" && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="space-y-4"
          >
            <Card className="border-emerald-500/50 bg-emerald-500/5">
              <CardContent className="flex items-center gap-4 p-4">
                <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="font-medium">Test Successful!</p>
                  <p className="text-sm text-muted-foreground">
                    Koya is ready to take real calls
                  </p>
                </div>
              </CardContent>
            </Card>

            <Button size="lg" className="w-full gap-2" onClick={() => handleComplete(false)}>
              Go to Dashboard
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>
        )}
      </div>
    </div>
  );
}
