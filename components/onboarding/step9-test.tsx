"use client";

/**
 * Koya Caller - Onboarding Step 9: Test Call & Activation
 * Spec Reference: Part 5, Lines 522-557
 * Spec Reference: Part 15, Lines 1846-1909 (Prompt Generation)
 * 
 * Features:
 * - Display Koya phone number
 * - Click to call functionality (phone) OR WebRTC call (browser)
 * - Test suggestions
 * - Edit links back to previous steps
 * - Generate AI bot on activation (calls Claude API)
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Phone,
  PartyPopper,
  Mic,
  MessageSquare,
  Settings,
  Languages,
  Calendar,
  ChevronRight,
  AlertTriangle,
  Monitor,
  Smartphone,
  Loader2,
  PhoneOff,
  Sparkles,
  CheckCircle2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { useOnboarding } from "@/lib/onboarding/context";

// Format phone number for display: +14155551234 -> (415) 555-1234
function formatPhoneNumber(e164: string): string {
  const digits = e164.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    const area = digits.slice(1, 4);
    const prefix = digits.slice(4, 7);
    const line = digits.slice(7, 11);
    return `(${area}) ${prefix}-${line}`;
  }
  return e164;
}

// Format for tel: link
function formatTelLink(e164: string): string {
  return `tel:${e164}`;
}

export function Step9TestCall() {
  const router = useRouter();
  const { state } = useOnboarding();
  const [hasCalledTest, setHasCalledTest] = useState(false);
  const [callMode, setCallMode] = useState<"phone" | "browser" | null>(null);
  const [isCallingBrowser, setIsCallingBrowser] = useState(false);
  const [browserCallError, setBrowserCallError] = useState<string | null>(null);
  const [browserCallActive, setBrowserCallActive] = useState(false);
  const [callStatus, setCallStatus] = useState<string>("");
  
  // Bot generation state
  const [isGeneratingBot, setIsGeneratingBot] = useState(false);
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [generationComplete, setGenerationComplete] = useState(false);
  const [generationStep, setGenerationStep] = useState<string>("");
  
  // Ref to hold the Retell client
  const retellClientRef = useRef<any>(null);
  
  const phoneNumber = state.step8Data?.selectedNumber || "";
  const spanishEnabled = state.step6Data?.spanishEnabled || false;
  const aiName = state.step7Data?.aiName || "Koya";
  
  // Check if we're in dev mode (mock phone number)
  const isDevMode = state.step8Data?.twilioSid === "dev_mode_skip" || !phoneNumber || phoneNumber === "+15551234567";
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (retellClientRef.current) {
        try {
          retellClientRef.current.stopCall();
        } catch (_e) {
          // Ignore cleanup errors
        }
      }
    };
  }, []);
  
  // Handle click to call (phone)
  const handleClickToCall = () => {
    setHasCalledTest(true);
    // The actual call happens via the tel: link
  };
  
  // Handle browser-based demo call via Retell WebRTC
  const handleBrowserCall = async () => {
    setIsCallingBrowser(true);
    setBrowserCallError(null);
    setCallStatus("Requesting microphone access...");
    
    try {
      // Request microphone permission first
      try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_micError) {
        throw new Error("Microphone access denied. Please allow microphone access to make a call.");
      }
      
      setCallStatus("Connecting to server...");
      
      // Get access token from our API
      const response = await fetch("/api/demo/call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId: state.businessId,
        }),
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || error.message || "Failed to start call");
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || "Failed to create call");
      }
      
      if (!data.accessToken) {
        throw new Error(data.error || "No access token returned. Make sure RETELL_API_KEY is configured.");
      }
      
      setCallStatus("Starting call...");
      
      // Dynamically import the Retell client SDK
      const { RetellWebClient } = await import("retell-client-js-sdk");
      
      const retellClient = new RetellWebClient();
      retellClientRef.current = retellClient;
      
      // Set up event listeners
      retellClient.on("call_started", () => {
        setCallStatus("Connected! Speak into your microphone.");
        setBrowserCallActive(true);
        setHasCalledTest(true);
      });
      
      retellClient.on("call_ended", () => {
        setCallStatus("Call ended");
        setBrowserCallActive(false);
        setIsCallingBrowser(false);
      });
      
      retellClient.on("error", (error: any) => {
        setBrowserCallError(`Call error: ${error.message || error}`);
        setBrowserCallActive(false);
        setIsCallingBrowser(false);
      });
      
      retellClient.on("agent_start_talking", () => {
        setCallStatus("Agent is speaking...");
      });
      
      retellClient.on("agent_stop_talking", () => {
        setCallStatus("Your turn to speak...");
      });
      
      // Start the call
      await retellClient.startCall({
        accessToken: data.accessToken,
      });
      
    } catch (error) {
      setBrowserCallError(
        error instanceof Error ? error.message : "Failed to start browser call"
      );
      setIsCallingBrowser(false);
      setCallStatus("");
    }
  };
  
  // Handle ending the browser call
  const handleEndCall = () => {
    if (retellClientRef.current) {
      try {
        retellClientRef.current.stopCall();
      } catch (_e) {
        // Error handled silently
      }
    }
    setBrowserCallActive(false);
    setIsCallingBrowser(false);
    setCallStatus("");
  };
  
  // Handle activate button - Generate the AI bot
  const handleActivate = async () => {
    if (!state.businessId) {
      setGenerationError("No business ID found. Please restart onboarding.");
      return;
    }
    
    setIsGeneratingBot(true);
    setGenerationError(null);
    setGenerationStep("Gathering your business information...");
    
    try {
      // Step 1: Generate the AI prompts via Claude API
      setGenerationStep("Creating your personalized AI assistant...");
      
      const promptResponse = await fetch("/api/claude/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: state.businessId }),
      });
      
      if (!promptResponse.ok) {
        const error = await promptResponse.json();
        throw new Error(error.error || "Failed to generate AI prompts");
      }
      
      const promptResult = await promptResponse.json();
      
      if (!promptResult.success) {
        throw new Error(promptResult.error || "Failed to generate AI prompts");
      }
      
      // Step 2: Create/Update the Retell agent with the new prompt
      setGenerationStep("Configuring voice capabilities...");
      
      const agentResponse = await fetch("/api/retell/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: state.businessId }),
      });
      
      if (!agentResponse.ok) {
        // Don't fail completely if Retell isn't configured - prompt is still saved
      }
      
      // Step 3: Mark onboarding as complete
      setGenerationStep("Finalizing setup...");
      
      const completeResponse = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId: state.businessId }),
      });
      
      if (!completeResponse.ok) {
        // Non-fatal - the bot is still generated
      }
      
      setGenerationComplete(true);
      setGenerationStep("");
      
      // Wait a moment to show success state, then redirect
      setTimeout(() => {
        router.push("/dashboard");
      }, 2000);
      
    } catch (error) {
      setGenerationError(
        error instanceof Error ? error.message : "Failed to generate your AI assistant"
      );
      setIsGeneratingBot(false);
      setGenerationStep("");
    }
  };
  
  // Edit links for adjusting settings
  const editLinks = [
    {
      href: "/onboarding/voice",
      label: "Edit Voice & Greeting",
      icon: Mic,
    },
    {
      href: "/onboarding/services",
      label: "Edit Services & FAQs",
      icon: MessageSquare,
    },
    {
      href: "/onboarding/calls",
      label: "Edit Call Handling",
      icon: Settings,
    },
    {
      href: "/onboarding/language",
      label: "Edit Language Settings",
      icon: Languages,
    },
    {
      href: "/onboarding/calendar",
      label: "Edit Calendar Settings",
      icon: Calendar,
    },
  ];
  
  return (
    <div className="space-y-8">
      {/* Dev Mode Notice */}
      {isDevMode && (
        <div className="rounded-lg border border-dashed border-amber-500/50 bg-amber-500/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-700 dark:text-amber-400">
                Development Mode
              </h4>
              <p className="mt-1 text-sm text-amber-600 dark:text-amber-300">
                You&apos;re testing without a real phone number. In production, configure Twilio 
                and Retell to enable actual phone calls with {aiName}.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {/* Hero Section */}
      <div className="rounded-xl border bg-gradient-to-b from-primary/10 to-transparent p-8 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
          <PartyPopper className="h-8 w-8 text-primary" />
        </div>
        
        <h2 className="mt-6 text-2xl font-bold">
          {aiName} is Ready{isDevMode ? " (Dev Mode)" : " for Testing"}!
        </h2>
        
        <p className="mt-2 text-muted-foreground">
          {isDevMode 
            ? `${aiName} is configured. Add real phone credentials to test calls.`
            : `Call your new number to hear ${aiName} in action`
          }
        </p>
        
        {/* Phone Number Display */}
        <div className="mt-6">
          <div className="inline-flex items-center gap-3 rounded-lg bg-card px-6 py-4 shadow-sm">
            <Phone className="h-6 w-6 text-primary" />
            <span className="font-mono text-2xl font-bold">
              {isDevMode ? "(555) 123-4567" : formatPhoneNumber(phoneNumber)}
            </span>
            {isDevMode && (
              <span className="text-xs text-muted-foreground">(Demo)</span>
            )}
          </div>
        </div>
        
        {/* Call Options */}
        {!isDevMode && !callMode && !browserCallActive && (
          <div className="mt-6 space-y-3">
            <p className="text-sm text-muted-foreground">How would you like to test?</p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button
                size="lg"
                variant="outline"
                className="gap-2"
                onClick={() => setCallMode("phone")}
              >
                <Smartphone className="h-5 w-5" />
                Call from my phone
              </Button>
              <Button
                size="lg"
                className="gap-2"
                onClick={() => setCallMode("browser")}
              >
                <Monitor className="h-5 w-5" />
                Call from browser
              </Button>
            </div>
          </div>
        )}
        
        {/* Phone Call Mode */}
        {!isDevMode && callMode === "phone" && !browserCallActive && (
          <div className="mt-6 space-y-3">
            <a
              href={formatTelLink(phoneNumber)}
              onClick={handleClickToCall}
              className="inline-flex"
            >
              <Button size="lg" className="gap-2">
                <Phone className="h-5 w-5" />
                Click to Call
              </Button>
            </a>
            <p className="text-sm text-muted-foreground">
              Or dial <span className="font-mono font-semibold">{formatPhoneNumber(phoneNumber)}</span> from your phone
            </p>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setCallMode(null)}
            >
              ← Choose different method
            </Button>
          </div>
        )}
        
        {/* Browser Call Mode */}
        {!isDevMode && callMode === "browser" && (
          <div className="mt-6 space-y-3">
            {browserCallActive ? (
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-lg bg-green-500/10 px-4 py-2 text-green-600">
                  <Phone className="h-5 w-5 animate-pulse" />
                  <span>{callStatus || "Call active - speak into your microphone!"}</span>
                </div>
                <div>
                  <Button
                    size="lg"
                    variant="destructive"
                    className="gap-2"
                    onClick={handleEndCall}
                  >
                    <PhoneOff className="h-5 w-5" />
                    End Call
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Button
                  size="lg"
                  className="gap-2"
                  onClick={handleBrowserCall}
                  disabled={isCallingBrowser}
                >
                  {isCallingBrowser ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      {callStatus || "Connecting..."}
                    </>
                  ) : (
                    <>
                      <Mic className="h-5 w-5" />
                      Start Browser Call
                    </>
                  )}
                </Button>
                
                {!isCallingBrowser && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setCallMode(null);
                      setBrowserCallError(null);
                    }}
                  >
                    ← Choose different method
                  </Button>
                )}
              </>
            )}
            
            {browserCallError && (
              <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
                {browserCallError}
              </div>
            )}
            
            {!browserCallActive && !isCallingBrowser && (
              <p className="text-sm text-muted-foreground">
                Uses your microphone to talk directly to {aiName}
              </p>
            )}
          </div>
        )}
        
        {/* Dev Mode - Disabled */}
        {isDevMode && (
          <div className="mt-6">
            <Button size="lg" className="gap-2" disabled>
              <Phone className="h-5 w-5" />
              Call Disabled in Dev Mode
            </Button>
          </div>
        )}
      </div>
      
      {/* Test Suggestions */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Try asking {aiName} to:</h3>
        
        <ul className="space-y-3">
          <li className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10">
              <Calendar className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="font-medium">Book an appointment</p>
              <p className="text-sm text-muted-foreground">
                &quot;I&apos;d like to schedule an appointment for next week&quot;
              </p>
            </div>
          </li>
          
          <li className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10">
              <MessageSquare className="h-4 w-4 text-accent" />
            </div>
            <div>
              <p className="font-medium">Answer a question about your services</p>
              <p className="text-sm text-muted-foreground">
                &quot;What services do you offer?&quot; or &quot;How much does X cost?&quot;
              </p>
            </div>
          </li>
          
          <li className="flex items-start gap-3 rounded-lg border bg-card p-4">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <Phone className="h-4 w-4 text-destructive" />
            </div>
            <div>
              <p className="font-medium">Handle an urgent request</p>
              <p className="text-sm text-muted-foreground">
                &quot;This is urgent, I need to speak to someone right away&quot;
              </p>
            </div>
          </li>
          
          {spanishEnabled && (
            <li className="flex items-start gap-3 rounded-lg border bg-card p-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-500/10">
                <Languages className="h-4 w-4 text-green-500" />
              </div>
              <div>
                <p className="font-medium">Switch to Spanish</p>
                <p className="text-sm text-muted-foreground">
                  &quot;¿Habla español?&quot; or start speaking in Spanish
                </p>
              </div>
            </li>
          )}
        </ul>
      </section>
      
      {/* Edit Links */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Not quite right?</h3>
        <p className="text-sm text-muted-foreground">
          Go back and adjust any settings:
        </p>
        
        <div className="grid gap-2 sm:grid-cols-2">
          {editLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between rounded-lg border bg-card p-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <link.icon className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{link.label}</span>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      </section>
      
      {/* Activate Section */}
      <section className="rounded-xl border-2 border-primary/20 bg-primary/5 p-6 text-center">
        {generationComplete ? (
          // Success State
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-500/20">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h3 className="text-xl font-semibold text-green-600 dark:text-green-400">
              {aiName} is Ready!
            </h3>
            <p className="text-sm text-muted-foreground">
              Your AI receptionist has been created and is ready to take calls.
              Redirecting to dashboard...
            </p>
            <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : isGeneratingBot ? (
          // Generating State
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Sparkles className="h-10 w-10 text-primary animate-pulse" />
            </div>
            <h3 className="text-lg font-semibold">Creating {aiName}...</h3>
            <p className="text-sm text-muted-foreground">
              {generationStep || "Please wait while we set up your AI receptionist..."}
            </p>
            <div className="flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
            <p className="text-xs text-muted-foreground">
              This usually takes 10-15 seconds
            </p>
          </div>
        ) : (
          // Ready to Generate State
          <>
            <h3 className="text-lg font-semibold">Ready to create {aiName}?</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              We&apos;ll generate a personalized AI receptionist based on your business information
            </p>
            
            {generationError && (
              <div className="mt-4 rounded-lg bg-destructive/10 px-4 py-3 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {generationError}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => setGenerationError(null)}
                >
                  Try Again
                </Button>
              </div>
            )}
            
            <Button
              size="lg"
              className="mt-4 gap-2"
              onClick={handleActivate}
              disabled={isGeneratingBot}
            >
              <Sparkles className="h-5 w-5" />
              Create {aiName}
            </Button>
            
            {hasCalledTest && (
              <p className="mt-3 text-xs text-muted-foreground">
                Great job testing! Click above to finalize your AI receptionist.
              </p>
            )}
          </>
        )}
      </section>
      
      {/* Back Button */}
      <div className="flex justify-start">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/onboarding/phone")}
        >
          Back
        </Button>
      </div>
    </div>
  );
}
