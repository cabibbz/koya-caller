"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import {
  Phone,
  PhoneOff,
  Mic,
  MicOff,
  Volume2,
  MessageSquare,
  Calendar,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
} from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Demo Section
 * Spec Reference: Part 2, Lines 71-79
 * Spec Reference: Part 3, Lines 132-158 (Demo Koya behavior)
 * Spec Reference: Part 20, Line 2141 (3 requests per 1 hour per IP)
 *
 * Features:
 * - Email capture before demo
 * - Real WebRTC calling via Retell
 * - Rate limiting (3 calls per hour)
 * - Language toggle (English/Spanish)
 */

type CallState = "idle" | "connecting" | "active" | "ended" | "error"

export function DemoSection() {
  const [email, setEmail] = useState("")
  const [language, setLanguage] = useState<"en" | "es">("en")
  const [hasSubmittedEmail, setHasSubmittedEmail] = useState(false)
  const [callState, setCallState] = useState<CallState>("idle")
  const [callStatus, setCallStatus] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [rateLimited, setRateLimited] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [callDuration, setCallDuration] = useState(0)

  // Refs
  const retellClientRef = useRef<any>(null)
  const durationIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall()
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
      if (durationIntervalRef.current) {
        clearInterval(durationIntervalRef.current)
      }
    }
  }, [])

  // Format call duration
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (email) {
      setHasSubmittedEmail(true)
      setError(null)
    }
  }

  const handleStartCall = useCallback(async () => {
    setCallState("connecting")
    setError(null)
    setCallStatus("Requesting microphone access...")

    try {
      // Request microphone permission
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true })
      } catch (_micError) {
        throw new Error("Microphone access denied. Please allow microphone access to talk to Koya.")
      }

      setCallStatus("Connecting to Koya...")

      // Get access token from API
      const response = await fetch("/api/demo/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, language }),
      })

      const data = await response.json()

      // Handle rate limiting
      if (data.rateLimited) {
        setRateLimited(true)
        setError(data.error || "Demo limit reached. Sign up for unlimited access!")
        setCallState("error")
        return
      }

      // Handle mock mode (no Retell API key)
      if (data.mock) {
        setError(data.error || "Demo not available in development mode.")
        setCallState("error")
        return
      }

      if (!data.success || !data.accessToken) {
        throw new Error(data.error || "Failed to start call")
      }

      setCallStatus("Starting call...")

      // Dynamically import Retell SDK
      const { RetellWebClient } = await import("retell-client-js-sdk")

      const retellClient = new RetellWebClient()
      retellClientRef.current = retellClient

      // Set up event listeners
      retellClient.on("call_started", () => {
        setCallState("active")
        setCallStatus("Connected! Say hello to Koya.")
        // Start duration timer
        durationIntervalRef.current = setInterval(() => {
          setCallDuration((prev) => prev + 1)
        }, 1000)
      })

      retellClient.on("call_ended", () => {
        setCallState("ended")
        setCallStatus("Call ended")
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current)
        }
      })

      retellClient.on("error", (err: any) => {
        setError(`Call error: ${err.message || err}`)
        setCallState("error")
        if (durationIntervalRef.current) {
          clearInterval(durationIntervalRef.current)
        }
      })

      retellClient.on("agent_start_talking", () => {
        setCallStatus("Koya is speaking...")
      })

      retellClient.on("agent_stop_talking", () => {
        setCallStatus("Your turn to speak...")
      })

      // Start the call
      await retellClient.startCall({
        accessToken: data.accessToken,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start call")
      setCallState("error")
    }
  }, [email, language])

  const handleEndCall = useCallback(() => {
    if (retellClientRef.current) {
      try {
        retellClientRef.current.stopCall()
      } catch (_e) {
        // Error handled silently
      }
    }
    setCallState("ended")
    setCallStatus("Call ended")
    if (durationIntervalRef.current) {
      clearInterval(durationIntervalRef.current)
    }
  }, [])

  const handleToggleMute = useCallback(() => {
    if (retellClientRef.current) {
      try {
        if (isMuted) {
          retellClientRef.current.unmute()
        } else {
          retellClientRef.current.mute()
        }
        setIsMuted(!isMuted)
      } catch (_e) {
        // Error handled silently
      }
    }
  }, [isMuted])

  const handleRestart = useCallback(() => {
    setCallState("idle")
    setCallStatus("")
    setCallDuration(0)
    setError(null)
  }, [])

  return (
    <section id="demo" className="py-24 relative">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-background via-card/50 to-background" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            <span className="text-foreground">Talk to </span>
            <span className="brand-gradient-text">Koya</span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Experience our AI receptionist firsthand. Koya can answer questions,
            book appointments, and show you exactly what she can do for your business.
          </p>
        </div>

        {/* Demo Container */}
        <div className="max-w-2xl mx-auto">
          <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-2xl">
            {/* Demo Header */}
            <div className="bg-gradient-to-r from-primary/10 to-accent/10 px-6 py-4 border-b border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center">
                    <Phone className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Demo Koya</h3>
                    <p className="text-sm text-muted-foreground">AI Phone Receptionist</p>
                  </div>
                </div>

                {/* Language Toggle */}
                {hasSubmittedEmail && callState === "idle" && (
                  <div className="flex items-center gap-2">
                    <Globe className="w-4 h-4 text-muted-foreground" />
                    <div className="flex rounded-lg border border-border overflow-hidden">
                      <button
                        onClick={() => setLanguage("en")}
                        className={cn(
                          "px-3 py-1.5 text-sm transition-colors",
                          language === "en"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        EN
                      </button>
                      <button
                        onClick={() => setLanguage("es")}
                        className={cn(
                          "px-3 py-1.5 text-sm transition-colors",
                          language === "es"
                            ? "bg-primary text-primary-foreground"
                            : "bg-background hover:bg-muted"
                        )}
                      >
                        ES
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Demo Content */}
            <div className="p-8">
              {!hasSubmittedEmail ? (
                /* Email Capture Form */
                <form onSubmit={handleEmailSubmit} className="space-y-4">
                  <p className="text-center text-muted-foreground mb-6">
                    Enter your email to talk to Koya
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3">
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="flex-1 px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                      required
                    />
                    <Button type="submit" size="lg">
                      Start Demo
                    </Button>
                  </div>
                  <p className="text-xs text-center text-muted">
                    By continuing, you agree to receive updates about Koya Caller.
                  </p>
                </form>
              ) : callState === "idle" ? (
                /* Ready to Call */
                <div className="text-center space-y-6">
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20">
                    <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
                    <span className="text-sm text-success">Ready to connect</span>
                  </div>

                  <div>
                    <Button
                      size="xl"
                      variant="accent"
                      className="rounded-full w-20 h-20"
                      onClick={handleStartCall}
                    >
                      <Phone className="w-8 h-8" />
                    </Button>
                    <p className="mt-4 text-muted-foreground">
                      Click to call Koya {language === "es" ? "(en Español)" : ""}
                    </p>
                  </div>

                  {/* What to Try */}
                  <div className="pt-6 border-t border-border">
                    <p className="text-sm font-medium text-foreground mb-4">
                      {language === "es" ? "Intenta pedirle a Koya que:" : "Try asking Koya to:"}
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <MessageSquare className="w-4 h-4 text-accent" />
                        <span>{language === "es" ? "Responder preguntas" : "Answer a question"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="w-4 h-4 text-accent" />
                        <span>{language === "es" ? "Reservar una cita" : "Book an appointment"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Volume2 className="w-4 h-4 text-accent" />
                        <span>{language === "es" ? "Explicar sus funciones" : "Explain her features"}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Sparkles className="w-4 h-4 text-accent" />
                        <span>{language === "es" ? "Hablar en inglés" : "Speak Spanish"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : callState === "connecting" ? (
                /* Connecting State */
                <div className="text-center space-y-6 py-8">
                  <Loader2 className="w-12 h-12 mx-auto animate-spin text-primary" />
                  <div>
                    <p className="font-medium text-foreground">{callStatus}</p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Please allow microphone access when prompted
                    </p>
                  </div>
                </div>
              ) : callState === "active" ? (
                /* Active Call */
                <div className="text-center space-y-6 py-4">
                  {/* Call Status */}
                  <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
                    <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-sm text-green-600">{callStatus}</span>
                  </div>

                  {/* Duration */}
                  <p className="font-mono text-3xl font-bold text-foreground">
                    {formatDuration(callDuration)}
                  </p>

                  {/* Audio Visualizer Placeholder */}
                  <div className="flex justify-center items-center gap-1 h-12">
                    {[...Array(12)].map((_, i) => (
                      <div
                        key={i}
                        className="w-1 bg-primary rounded-full animate-pulse"
                        style={{
                          height: `${Math.random() * 100}%`,
                          animationDelay: `${i * 0.1}s`,
                        }}
                      />
                    ))}
                  </div>

                  {/* Call Controls */}
                  <div className="flex justify-center gap-4">
                    <Button
                      variant="outline"
                      size="lg"
                      className={cn(
                        "rounded-full w-14 h-14",
                        isMuted && "bg-red-500/10 border-red-500/20"
                      )}
                      onClick={handleToggleMute}
                    >
                      {isMuted ? (
                        <MicOff className="w-6 h-6 text-red-500" />
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
                      <PhoneOff className="w-6 h-6" />
                    </Button>
                  </div>
                </div>
              ) : callState === "ended" ? (
                /* Call Ended */
                <div className="text-center space-y-6 py-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                    <Phone className="w-8 h-8 text-primary" />
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      Thanks for talking to Koya!
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      Call lasted {formatDuration(callDuration)}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button variant="outline" onClick={handleRestart}>
                      <Phone className="w-4 h-4 mr-2" />
                      Call Again
                    </Button>
                    <Button asChild>
                      <Link href="/signup">
                        Get Started Free
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : callState === "error" ? (
                /* Error State */
                <div className="text-center space-y-6 py-4">
                  <div className="w-16 h-16 mx-auto rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="w-8 h-8 text-destructive" />
                  </div>

                  <div>
                    <h3 className="text-xl font-semibold text-foreground">
                      {rateLimited ? "Demo Limit Reached" : "Something went wrong"}
                    </h3>
                    <p className="text-muted-foreground mt-2">
                      {error || "Please try again later"}
                    </p>
                  </div>

                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    {!rateLimited && (
                      <Button variant="outline" onClick={handleRestart}>
                        Try Again
                      </Button>
                    )}
                    <Button asChild>
                      <Link href="/signup">
                        {rateLimited ? "Sign Up for Unlimited Access" : "Get Started Free"}
                      </Link>
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>

          {/* Features List */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { icon: Phone, text: "Introduces herself" },
              { icon: MessageSquare, text: "Answers questions" },
              { icon: Calendar, text: "Books appointments" },
              { icon: Volume2, text: "Speaks Spanish" },
            ].map((feature, index) => (
              <div
                key={index}
                className="flex flex-col items-center gap-2 p-4 bg-card/50 rounded-xl border border-border"
              >
                <feature.icon className="w-5 h-5 text-accent" />
                <span className="text-sm text-muted-foreground text-center">
                  {feature.text}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
