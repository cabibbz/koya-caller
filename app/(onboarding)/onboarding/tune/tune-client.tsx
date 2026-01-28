"use client";

/**
 * Phase 2: Tune - Customize Koya
 * Review and adjust AI-generated settings
 */

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ProgressPath, KoyaAvatar } from "@/components/onboarding-v2";
import {
  Check,
  ChevronRight,
  Sparkles,
  MessageSquare,
  BookOpen,
  Mic,
  Play,
  Pause,
  Plus,
  Trash2,
  X,
  Loader2,
  Globe,
} from "lucide-react";
import { VOICE_SAMPLES, STYLE_DESCRIPTIONS } from "@/lib/onboarding/voice-samples";
import type { VoiceSample } from "@/types/onboarding";

type Section = "services" | "faqs" | "voice" | null;

export function TunePageClient() {
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<Section>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isScraping, setIsScraping] = useState(false);
  const [scrapeStatus, setScrapeStatus] = useState<string | null>(null);

  // Services state
  const [services, setServices] = useState<{ id: string; name: string; duration: number }[]>([]);
  const [newService, setNewService] = useState("");

  // FAQs state
  const [faqs, setFaqs] = useState<{ id: string; question: string; answer: string }[]>([]);
  const [newFaq, setNewFaq] = useState({ question: "", answer: "" });

  // Voice state - use static VOICE_SAMPLES like settings page
  const [selectedVoice, setSelectedVoice] = useState<string>(VOICE_SAMPLES[0].retellVoiceId);
  const [selectedGender, setSelectedGender] = useState<"female" | "male">("female");
  const [playingVoice, setPlayingVoice] = useState<string | null>(null);
  const [loadingVoice, setLoadingVoice] = useState<string | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);

  // Filter voices by selected gender
  const filteredVoices = VOICE_SAMPLES.filter((voice) => voice.gender === selectedGender);

  // Load existing data and voices on mount
  useEffect(() => {
    async function loadData() {
      try {
        // Fetch existing onboarding data
        const dataResponse = await fetch("/api/onboarding/phase2");
        if (dataResponse.ok) {
          const data = await dataResponse.json();
          const hasExistingServices = data.services && data.services.length > 0;
          const hasExistingFaqs = data.faqs && data.faqs.length > 0;
          const websiteUrl = data.websiteUrl;

          // If website URL exists and no data yet, auto-scrape
          if (websiteUrl && !hasExistingServices && !hasExistingFaqs) {
            setIsLoading(false);
            setIsScraping(true);
            setScrapeStatus("Importing from your website...");

            try {
              const scrapeResponse = await fetch("/api/dashboard/knowledge/scrape", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url: websiteUrl }),
              });

              if (scrapeResponse.ok) {
                const scrapeData = await scrapeResponse.json();
                if (scrapeData.success && scrapeData.data) {
                  // Populate services from scraped data
                  if (scrapeData.data.services && scrapeData.data.services.length > 0) {
                    setServices(scrapeData.data.services.map((s: { name: string; description?: string; duration_minutes?: number }, idx: number) => ({
                      id: `scraped-${idx}`,
                      name: s.name,
                      duration: s.duration_minutes || 30,
                    })));
                  } else {
                    setServices([
                      { id: "1", name: "General Inquiry", duration: 15 },
                      { id: "2", name: "Appointment Booking", duration: 30 },
                    ]);
                  }

                  // Populate FAQs from scraped data
                  if (scrapeData.data.faqs && scrapeData.data.faqs.length > 0) {
                    setFaqs(scrapeData.data.faqs.map((f: { question: string; answer: string }, idx: number) => ({
                      id: `scraped-${idx}`,
                      question: f.question,
                      answer: f.answer,
                    })));
                  } else {
                    setFaqs([
                      { id: "1", question: "What are your hours?", answer: "We're open Monday-Friday 9am-5pm" },
                      { id: "2", question: "Do you accept walk-ins?", answer: "Yes, but appointments are recommended" },
                    ]);
                  }

                  setScrapeStatus("Website imported successfully!");
                } else {
                  // Scrape failed, use defaults
                  setServices([
                    { id: "1", name: "General Inquiry", duration: 15 },
                    { id: "2", name: "Appointment Booking", duration: 30 },
                  ]);
                  setFaqs([
                    { id: "1", question: "What are your hours?", answer: "We're open Monday-Friday 9am-5pm" },
                    { id: "2", question: "Do you accept walk-ins?", answer: "Yes, but appointments are recommended" },
                  ]);
                  setScrapeStatus(null);
                }
              }
            } catch {
              // Scrape error, use defaults
              setServices([
                { id: "1", name: "General Inquiry", duration: 15 },
                { id: "2", name: "Appointment Booking", duration: 30 },
              ]);
              setFaqs([
                { id: "1", question: "What are your hours?", answer: "We're open Monday-Friday 9am-5pm" },
                { id: "2", question: "Do you accept walk-ins?", answer: "Yes, but appointments are recommended" },
              ]);
            } finally {
              setIsScraping(false);
            }
            return;
          }

          // No website URL or data already exists - use existing or defaults
          if (hasExistingServices) {
            setServices(data.services);
          } else {
            setServices([
              { id: "1", name: "General Inquiry", duration: 15 },
              { id: "2", name: "Appointment Booking", duration: 30 },
            ]);
          }
          if (hasExistingFaqs) {
            setFaqs(data.faqs);
          } else {
            setFaqs([
              { id: "1", question: "What are your hours?", answer: "We're open Monday-Friday 9am-5pm" },
              { id: "2", question: "Do you accept walk-ins?", answer: "Yes, but appointments are recommended" },
            ]);
          }
          if (data.voiceId) {
            setSelectedVoice(data.voiceId);
          }
        }
      } catch {
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

    loadData();
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

  // Audio playback - matches settings page implementation
  const handlePlayVoice = async (voice: VoiceSample) => {
    // Stop current audio
    if (audioElement) {
      audioElement.pause();
      audioElement.src = "";
      setAudioElement(null);
    }

    // If same voice, just stop
    if (playingVoice === voice.id) {
      setPlayingVoice(null);
      return;
    }

    setLoadingVoice(voice.id);
    setPlayingVoice(null);

    try {
      const audio = new Audio();

      // Set up event handlers before setting src
      audio.onended = () => {
        setPlayingVoice(null);
        setAudioElement(null);
      };

      audio.onerror = () => {
        // Audio failed to load - reset state silently
        setLoadingVoice(null);
        setPlayingVoice(null);
        setAudioElement(null);
      };

      // Set source and load - uses local proxy endpoint
      audio.src = voice.previewUrl;
      setAudioElement(audio);

      // Wait for audio to be ready then play
      await audio.play();
      setLoadingVoice(null);
      setPlayingVoice(voice.id);
    } catch {
      // Audio playback failed - reset state silently
      setLoadingVoice(null);
      setPlayingVoice(null);
      setAudioElement(null);
    }
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

            {/* Gender filter - matches settings page */}
            <div className="flex gap-2">
              <Button
                variant={selectedGender === "female" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGender("female")}
                className="flex-1"
              >
                Female
              </Button>
              <Button
                variant={selectedGender === "male" ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedGender("male")}
                className="flex-1"
              >
                Male
              </Button>
            </div>

            {/* Voice options - same voices as settings */}
            <div className="grid gap-3">
              {filteredVoices.map((voice) => (
                <div
                  key={voice.id}
                  className={`relative p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedVoice === voice.retellVoiceId
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedVoice(voice.retellVoiceId)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-medium">{voice.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {STYLE_DESCRIPTIONS[voice.style] || voice.style}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-10 w-10"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePlayVoice(voice);
                      }}
                    >
                      {loadingVoice === voice.id ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                      ) : playingVoice === voice.id ? (
                        <Pause className="w-5 h-5" />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                    </Button>
                  </div>
                  {selectedVoice === voice.retellVoiceId && (
                    <div className="absolute -right-1 -top-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                      <Check className="w-3 h-3 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
            </div>

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
        {isLoading || isScraping ? (
          <div className="flex flex-col items-center justify-center py-20">
            {isScraping ? (
              <>
                <div className="relative mb-4">
                  <Globe className="w-8 h-8 text-primary" />
                  <Loader2 className="w-4 h-4 animate-spin text-primary absolute -bottom-1 -right-1" />
                </div>
                <p className="text-foreground font-medium mb-1">{scrapeStatus || "Importing from website..."}</p>
                <p className="text-sm text-muted-foreground">This may take a few seconds</p>
              </>
            ) : (
              <>
                <Loader2 className="w-8 h-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Loading your settings...</p>
              </>
            )}
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
                        router.push("/onboarding/phone");
                      } else {
                        // Show warning but still navigate - user can fix in dashboard later
                        toast({ title: "Partial Save", description: "Settings saved partially. You can adjust them in the dashboard.", variant: "warning" });
                        router.push("/onboarding/phone");
                      }
                    } catch {
                      toast({ title: "Warning", description: "Couldn't save all settings. You can adjust them in the dashboard.", variant: "warning" });
                      router.push("/onboarding/phone");
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
                      Continue to Phone Setup
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
