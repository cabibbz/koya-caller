"use client";

/**
 * Phase 2: Tune - Customize Koya
 * Review and adjust AI-generated settings
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProgressPath, KoyaAvatar } from "@/components/onboarding-v2";
import {
  Check,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  MessageSquare,
  BookOpen,
  Mic,
  Play,
  Pause,
  Plus,
  Trash2,
  X,
  Volume2,
  Loader2,
} from "lucide-react";

// Voice type from API
interface Voice {
  voice_id: string;
  voice_name: string;
  provider: string;
  gender: string;
  accent: string;
  age: string;
  preview_audio_url: string | null;
}

type Section = "services" | "faqs" | "voice" | null;

export default function TunePage() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Services state
  const [services, setServices] = useState<{ id: string; name: string; duration: number }[]>([]);
  const [newService, setNewService] = useState("");

  // FAQs state
  const [faqs, setFaqs] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  // Voice state
  const [voices, setVoices] = useState<Voice[]>([]);
  const [selectedVoice, setSelectedVoice] = useState<string>("");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  const [loadingVoices, setLoadingVoices] = useState(true);

  // Load existing data and voices on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch existing onboarding data
        const dataResponse = await fetch("/api/onboarding/phase2");
        if (dataResponse.ok) {
          const data = await dataResponse.json();
          if (data.services && data.services.length > 0) {
            setServices(data.services);
          } else {
            // Default services if none exist
            setServices([
              { id: "1", name: "General Inquiry", duration: 15 },
              { id: "2", name: "Appointment Booking", duration: 30 },
            ]);
          }
          if (data.faqs && data.faqs.length > 0) {
            setFaqs(data.faqs);
          } else {
            // Default FAQs if none exist
            setFaqs([
              { id: "1", question: "What are your hours?", answer: "We're open Monday-Friday 9am-5pm" },
              { id: "2", question: "Do you accept walk-ins?", answer: "Yes, but appointments are recommended" },
            ]);
          }
          if (data.voiceId) {
            setSelectedVoice(data.voiceId);
          }
        }
      } catch (error) {
        console.error("Failed to load data:", error);
        // Set defaults on error
        setServices([
          { id: "1", name: "General Inquiry", duration: 15 },
          { id: "2", name: "Appointment Booking", duration: 30 },
        ]);
        setFaqs([
          { id: "1", question: "What are your hours?", answer: "We're open Monday-Friday 9am-5pm" },
          { id: "2", question: "Do you accept walk-ins?", answer: "Yes, but appointments are recommended" },
        ]);
      } finally {
        setIsLoading(false);
      }
    }

    async function fetchVoices() {
      try {
        const response = await fetch("/api/retell/voices");
        const data = await response.json();
        if (data.success && data.voices) {
          setVoices(data.voices);
          // Only set default voice if no voice is already selected
          if (data.voices.length > 0 && !selectedVoice) {
            setSelectedVoice(data.voices[0].voice_id);
          }
        }
      } catch (error) {
        console.error("Failed to fetch voices:", error);
      } finally {
        setLoadingVoices(false);
      }
    }

    loadData();
    fetchVoices();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sections = [
    {
      id: "services" as Section,
      title: "Services",
      description: "What you offer",
      icon: BookOpen,
      count: services.length,
    },
    {
      id: "faqs" as Section,
      title: "FAQs",
      description: "Common questions",
      icon: MessageSquare,
      count: faqs.length,
    },
    {
      id: "voice" as Section,
      title: "Voice",
      description: "How Koya sounds",
      icon: Mic,
      count: null,
    },
  ];

  // Audio playback
  const handlePlayVoice = (voiceId: string, previewUrl: string) => {
    // Stop current audio
    if (audioElement) {
      audioElement.pause();
      setAudioElement(null);
    }

    // If same voice, just stop
    if (playingVoice === voiceId) {
      setPlayingVoice(null);
      return;
    }

    setLoadingVoice(voiceId);
    const audio = new Audio(previewUrl);

    audio.oncanplaythrough = () => {
      setLoadingVoice(null);
      setPlayingVoice(voiceId);
      audio.play();
    };

    audio.onended = () => {
      setPlayingVoice(null);
      setAudioElement(null);
    };

    audio.onerror = () => {
      setLoadingVoice(null);
      setPlayingVoice(null);
      console.error("Failed to load audio");
    };

    setAudioElement(audio);
    audio.load();
  };

  // Service handlers
  const addService = () => {
    if (newService.trim()) {
      setServices([...services, { id: Date.now().toString(), name: newService, duration: 30 }]);
      setNewService("");
    }
  };

  const removeService = (id: string) => {
    setServices(services.filter((s) => s.id !== id));
  };

  // FAQ handlers
  const addFaq = () => {
    if (newFaq.question.trim() && newFaq.answer.trim()) {
      setFaqs([...faqs, { id: Date.now().toString(), ...newFaq }]);
      setNewFaq({ question: "", answer: "" });
    }
  };

  const removeFaq = (id: string) => {
    setFaqs(faqs.filter((f) => f.id !== id));
  };

  // Render section content
  const renderSectionContent = () => {
    switch (activeSection) {
      case "services":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Services</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Add the services you offer so Koya can help callers book appointments.
            </p>

            {/* Service list */}
            <div className="space-y-2">
              {services.map((service) => (
                <div
                  key={service.id}
                  className="flex items-center justify-between p-3 bg-card border rounded-lg"
                >
                  <span className="font-medium">{service.name}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">{service.duration} min</span>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => removeService(service.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add service */}
            <div className="flex gap-2">
              <Input
                placeholder="Add a service..."
                value={newService}
                onChange={(e) => setNewService(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addService()}
              />
              <Button onClick={addService}>
                <Plus className="w-4 h-4" />
              </Button>
            </div>

            <Button className="w-full" onClick={() => setActiveSection(null)}>
              Done
            </Button>
          </div>
        );

      case "faqs":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">FAQs</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Add common questions so Koya can answer them for callers.
            </p>

            {/* FAQ list */}
            <div className="space-y-3">
              {faqs.map((faq) => (
                <div key={faq.id} className="p-3 bg-card border rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium">{faq.question}</p>
                      <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive shrink-0"
                      onClick={() => removeFaq(faq.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add FAQ */}
            <div className="space-y-2 p-3 border border-dashed rounded-lg">
              <Input
                placeholder="Question..."
                value={newFaq.question}
                onChange={(e) => setNewFaq({ ...newFaq, question: e.target.value })}
              />
              <Textarea
                placeholder="Answer..."
                value={newFaq.answer}
                onChange={(e) => setNewFaq({ ...newFaq, answer: e.target.value })}
                rows={2}
              />
              <Button onClick={addFaq} className="w-full" disabled={!newFaq.question || !newFaq.answer}>
                <Plus className="w-4 h-4 mr-2" />
                Add FAQ
              </Button>
            </div>

            <Button className="w-full" onClick={() => setActiveSection(null)}>
              Done
            </Button>
          </div>
        );

      case "voice":
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold">Voice</h2>
              <Button variant="ghost" size="sm" onClick={() => setActiveSection(null)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <p className="text-muted-foreground text-sm">
              Choose how Koya sounds when answering calls.
            </p>

            {/* Voice options */}
            {loadingVoices ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-muted-foreground">Loading voices...</span>
              </div>
            ) : (
              <div className="grid gap-3">
                {voices.map((voice) => (
                  <div
                    key={voice.voice_id}
                    className={`relative p-4 rounded-lg border cursor-pointer transition-all ${
                      selectedVoice === voice.voice_id
                        ? "border-primary bg-primary/5 ring-1 ring-primary"
                        : "border-border hover:border-primary/50"
                    }`}
                    onClick={() => setSelectedVoice(voice.voice_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-medium">{voice.voice_name}</h4>
                        <p className="text-sm text-muted-foreground">
                          {voice.accent} · {voice.age}
                        </p>
                        <span className="text-xs text-muted-foreground capitalize">{voice.gender}</span>
                      </div>
                      {voice.preview_audio_url ? (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-10 w-10"
                          onClick={(e) => {
                            e.stopPropagation();
                            handlePlayVoice(voice.voice_id, voice.preview_audio_url!);
                          }}
                        >
                          {loadingVoice === voice.voice_id ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                          ) : playingVoice === voice.voice_id ? (
                            <Pause className="w-5 h-5" />
                          ) : (
                            <Play className="w-5 h-5" />
                          )}
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">No preview</span>
                      )}
                    </div>
                    {selectedVoice === voice.voice_id && (
                      <div className="absolute -right-1 -top-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                        <Volume2 className="w-3 h-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <Button className="w-full" onClick={() => setActiveSection(null)}>
              Done
            </Button>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Progress bar */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <ProgressPath currentPhase={2} />
        </div>
      </div>

      {/* Content */}
      <div className="max-w-2xl mx-auto px-4 py-12">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Loading your settings...</p>
          </div>
        ) : (
        <AnimatePresence mode="wait">
          {activeSection ? (
            <motion.div
              key="section"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
            >
              {renderSectionContent()}
            </motion.div>
          ) : (
            <motion.div
              key="main"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
            >
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-8"
              >
                <div className="flex justify-center mb-4">
                  <KoyaAvatar state="celebrating" size="lg" />
                </div>
                <h1 className="text-2xl font-bold mb-2">Customize Koya</h1>
                <p className="text-muted-foreground">
                  Review what I learned and make any adjustments
                </p>
              </motion.div>

              {/* Settings cards */}
              <div className="space-y-4 mb-8">
                {sections.map((section, index) => (
                  <motion.div
                    key={section.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                  >
                    <Card
                      className="hover:border-primary/50 transition-colors cursor-pointer"
                      onClick={() => setActiveSection(section.id)}
                    >
                      <CardContent className="flex items-center gap-4 p-4">
                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <section.icon className="w-6 h-6 text-primary" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-medium">{section.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {section.description}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          {section.count !== null && (
                            <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-full">
                              {section.count} items
                            </span>
                          )}
                          <span className="text-xs text-emerald-500 flex items-center gap-1">
                            <Check className="w-3 h-3" />
                            Ready
                          </span>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* AI summary */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="bg-primary/5 border border-primary/20 rounded-xl p-4 mb-8"
              >
                <div className="flex items-start gap-3">
                  <Sparkles className="w-5 h-5 text-primary mt-0.5" />
                  <div>
                    <p className="font-medium text-sm">AI-Optimized</p>
                    <p className="text-sm text-muted-foreground">
                      I&apos;ve pre-configured everything based on your business type.
                      Click any section above to customize, or continue to test!
                    </p>
                  </div>
                </div>
              </motion.div>

              {/* Continue button */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
              >
                <Button
                  size="lg"
                  className="w-full gap-2"
                  disabled={isSaving}
                  onClick={async () => {
                    setIsSaving(true);
                    try {
                      const response = await fetch("/api/onboarding/phase2", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          services,
                          faqs,
                          voiceId: selectedVoice,
                        }),
                      });

                      if (response.ok) {
                        router.push("/onboarding/test");
                      } else {
                        console.error("Failed to save phase 2 data");
                        // Still navigate on error - user can fix later
                        router.push("/onboarding/test");
                      }
                    } catch (error) {
                      console.error("Error saving:", error);
                      router.push("/onboarding/test");
                    }
                  }}
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      Continue to Test Call
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </Button>
                <p className="text-center text-xs text-muted-foreground mt-3">
                  You can always adjust these settings later in your dashboard
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        )}
      </div>
    </div>
  );
}
