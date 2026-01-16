"use client";

/**
 * Koya Caller - Onboarding Step 7: Voice & Personality
 * Spec Reference: Part 5, Lines 396-416
 * 
 * Features:
 * - Voice selection with audio previews (using Retell's public CDN)
 * - Personality selection (Professional, Friendly, Casual)
 * - Editable greeting
 * - Custom AI name option
 */

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Play, Pause, Volume2, User, Sparkles, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOnboarding } from "@/lib/onboarding/context";
import {
  VOICE_SAMPLES,
  getDefaultGreeting,
  getDefaultGreetingSpanish,
  STYLE_DESCRIPTIONS,
} from "@/lib/onboarding/voice-samples";
import {
  type Step7FormData,
  type Personality,
  type VoiceSample,
  DEFAULT_STEP7_DATA,
  PERSONALITY_OPTIONS,
} from "@/types/onboarding";

export function Step7VoicePersonality() {
  const router = useRouter();
  const { state, setStep7Data, completeStep } = useOnboarding();
  
  // Audio ref for playback
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Step7FormData>(
    state.step7Data || {
      ...DEFAULT_STEP7_DATA,
      greeting: getDefaultGreeting(state.businessTypeName || "your business"),
      greetingSpanish: getDefaultGreetingSpanish(state.businessTypeName || "your business"),
    }
  );
  
  // UI state
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [selectedGender, setSelectedGender] = useState<"female" | "male">("female");
  const [useCustomName, setUseCustomName] = useState(formData.aiName !== "Koya");
  const [isSaving, setIsSaving] = useState(false);
  
  // Check if Spanish is enabled from Step 6
  const spanishEnabled = state.step6Data?.spanishEnabled || false;
  
  // Filter voices by gender and bilingual support
  const filteredVoices = VOICE_SAMPLES.filter((voice) => {
    if (voice.gender !== selectedGender) return false;
    // If Spanish is enabled, only show bilingual voices
    if (spanishEnabled && !voice.supportsBilingual) return false;
    return true;
  });
  
  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Update greeting when business name changes
  useEffect(() => {
    if (state.businessTypeName && !state.step7Data) {
      setFormData((prev) => ({
        ...prev,
        greeting: getDefaultGreeting(state.businessTypeName!, prev.aiName),
        greetingSpanish: getDefaultGreetingSpanish(state.businessTypeName!, prev.aiName),
      }));
    }
  }, [state.businessTypeName, state.step7Data]);
  
  // Handle voice preview playback
  const handlePlayVoice = async (voice: VoiceSample) => {
    // If clicking the same voice that's playing, stop it
    if (playingVoiceId === voice.id) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlayingVoiceId(null);
      return;
    }
    
    // Stop any currently playing audio
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    
    // Start loading new audio
    setLoadingVoiceId(voice.id);
    setPlayingVoiceId(null);
    
    try {
      const audio = new Audio(voice.previewUrl);
      audioRef.current = audio;
      
      // Handle audio events
      audio.oncanplaythrough = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(voice.id);
        audio.play().catch(() => {});
      };
      
      audio.onended = () => {
        setPlayingVoiceId(null);
        audioRef.current = null;
      };
      
      audio.onerror = () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(null);
        audioRef.current = null;
      };
      
      // Start loading
      audio.load();
    } catch (_error) {
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
    }
  };
  
  // Handle voice selection
  const handleSelectVoice = (voice: VoiceSample) => {
    setFormData((prev) => ({
      ...prev,
      voiceId: voice.id,
      voiceIdSpanish: voice.supportsBilingual ? voice.id : null,
    }));
  };
  
  // Handle personality selection
  const handleSelectPersonality = (personality: Personality) => {
    setFormData((prev) => ({
      ...prev,
      personality,
    }));
  };
  
  // Handle AI name change
  const handleNameChange = (customName: boolean, name?: string) => {
    setUseCustomName(customName);
    const newName = customName ? (name || "") : "Koya";
    setFormData((prev) => ({
      ...prev,
      aiName: newName,
      greeting: getDefaultGreeting(state.businessTypeName || "your business", newName || "Koya"),
      greetingSpanish: getDefaultGreetingSpanish(state.businessTypeName || "your business", newName || "Koya"),
    }));
  };
  
  // Handle form submission
  const handleSubmit = async () => {
    if (!formData.voiceId) {
      return; // Voice selection required
    }
    
    setIsSaving(true);
    
    try {
      // Save to context
      setStep7Data(formData);
      completeStep(7);
      
      // Navigate to next step
      router.push("/onboarding/phone");
    } catch (_error) {
      // Error handled silently
    } finally {
      setIsSaving(false);
    }
  };
  
  return (
    <div className="space-y-8">
      {/* Voice Selection */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Choose Koya&apos;s Voice</h3>
          <p className="text-sm text-muted-foreground">
            Select a voice that matches your brand personality
            {spanishEnabled && " (showing bilingual voices only)"}
          </p>
        </div>
        
        {/* Gender Toggle */}
        <div className="flex gap-2">
          <Button
            type="button"
            variant={selectedGender === "female" ? "default" : "outline"}
            onClick={() => setSelectedGender("female")}
            className="flex-1"
          >
            Female Voices
          </Button>
          <Button
            type="button"
            variant={selectedGender === "male" ? "default" : "outline"}
            onClick={() => setSelectedGender("male")}
            className="flex-1"
          >
            Male Voices
          </Button>
        </div>
        
        {/* Voice Grid */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filteredVoices.map((voice) => (
            <div
              key={voice.id}
              className={`relative rounded-lg border p-4 transition-all cursor-pointer ${
                formData.voiceId === voice.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
              onClick={() => handleSelectVoice(voice)}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <h4 className="font-medium">{voice.name}</h4>
                  <p className="text-sm text-muted-foreground capitalize">
                    {STYLE_DESCRIPTIONS[voice.style]}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {voice.provider === "elevenlabs" ? "ElevenLabs" : "OpenAI"}
                    </span>
                    {voice.supportsBilingual && (
                      <span className="rounded bg-accent/20 px-1.5 py-0.5 text-xs text-accent">
                        Bilingual
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Play Button */}
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="h-10 w-10 shrink-0"
                  onClick={(e) => {
                    e.stopPropagation();
                    handlePlayVoice(voice);
                  }}
                  disabled={loadingVoiceId === voice.id}
                >
                  {loadingVoiceId === voice.id ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : playingVoiceId === voice.id ? (
                    <Pause className="h-5 w-5" />
                  ) : (
                    <Play className="h-5 w-5" />
                  )}
                </Button>
              </div>
              
              {/* Selection indicator */}
              {formData.voiceId === voice.id && (
                <div className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Volume2 className="h-3 w-3" />
                </div>
              )}
            </div>
          ))}
        </div>
        
        {filteredVoices.length === 0 && (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <p className="text-muted-foreground">
              No {selectedGender} bilingual voices available. Try selecting the other gender.
            </p>
          </div>
        )}
      </section>
      
      {/* Personality Selection */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Koya&apos;s Personality</h3>
          <p className="text-sm text-muted-foreground">
            How should Koya interact with your callers?
          </p>
        </div>
        
        <div className="grid gap-3 sm:grid-cols-3">
          {PERSONALITY_OPTIONS.map((option) => (
            <div
              key={option.value}
              className={`rounded-lg border p-4 transition-all cursor-pointer ${
                formData.personality === option.value
                  ? "border-primary bg-primary/5 ring-1 ring-primary"
                  : "border-muted hover:border-muted-foreground/50"
              }`}
              onClick={() => handleSelectPersonality(option.value)}
            >
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  formData.personality === option.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}>
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-medium">{option.label}</h4>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
      
      {/* AI Name */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">AI Assistant Name</h3>
          <p className="text-sm text-muted-foreground">
            What should your AI assistant be called?
          </p>
        </div>
        
        <div className="space-y-3">
          <div
            className={`rounded-lg border p-4 transition-all cursor-pointer ${
              !useCustomName
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-muted hover:border-muted-foreground/50"
            }`}
            onClick={() => handleNameChange(false)}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                !useCustomName ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                <User className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-medium">Koya</h4>
                <p className="text-sm text-muted-foreground">Use the default name</p>
              </div>
            </div>
          </div>
          
          <div
            className={`rounded-lg border p-4 transition-all cursor-pointer ${
              useCustomName
                ? "border-primary bg-primary/5 ring-1 ring-primary"
                : "border-muted hover:border-muted-foreground/50"
            }`}
            onClick={() => handleNameChange(true, formData.aiName === "Koya" ? "" : formData.aiName)}
          >
            <div className="flex items-center gap-3">
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
                useCustomName ? "bg-primary text-primary-foreground" : "bg-muted"
              }`}>
                <User className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <h4 className="font-medium">Custom Name</h4>
                {useCustomName ? (
                  <Input
                    value={formData.aiName === "Koya" ? "" : formData.aiName}
                    onChange={(e) => handleNameChange(true, e.target.value)}
                    placeholder="Enter a custom name"
                    className="mt-2"
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Give your assistant a unique name
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>
      
      {/* Greeting Customization */}
      <section className="space-y-4">
        <div>
          <h3 className="text-lg font-semibold">Greeting Message</h3>
          <p className="text-sm text-muted-foreground">
            How {formData.aiName || "Koya"} will answer calls
          </p>
        </div>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="greeting">English Greeting</Label>
            <Textarea
              id="greeting"
              value={formData.greeting}
              onChange={(e) =>
                setFormData((prev) => ({ ...prev, greeting: e.target.value }))
              }
              placeholder="Thanks for calling [Business Name], this is Koya. How can I help you today?"
              rows={3}
            />
          </div>
          
          {spanishEnabled && (
            <div className="space-y-2">
              <Label htmlFor="greetingSpanish">Spanish Greeting</Label>
              <Textarea
                id="greetingSpanish"
                value={formData.greetingSpanish}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, greetingSpanish: e.target.value }))
                }
                placeholder="Gracias por llamar a [Nombre del Negocio], soy Koya. ¿En qué puedo ayudarle hoy?"
                rows={3}
              />
            </div>
          )}
        </div>
      </section>
      
      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/onboarding/language")}
        >
          Back
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={!formData.voiceId || isSaving}
        >
          {isSaving ? "Saving..." : "Continue"}
        </Button>
      </div>
    </div>
  );
}
