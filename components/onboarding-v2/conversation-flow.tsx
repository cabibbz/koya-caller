"use client";

/**
 * Conversational Onboarding Flow
 * Chat-style interface for setting up Koya
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChatBubble } from "./chat-bubble";
import { KoyaAvatar } from "./koya-avatar";
import { LearningAnimation } from "./learning-animation";
import { PhonePreviewMini } from "./phone-preview";
import { ChevronRight, Building2, Briefcase, Stethoscope, Car, Utensils, Wrench, Scissors } from "lucide-react";

// Business type categories with icons
const BUSINESS_CATEGORIES = [
  {
    id: "home_services",
    label: "Home Services",
    icon: Wrench,
    types: ["hvac", "plumbing", "electrical", "roofing", "landscaping", "cleaning"],
  },
  {
    id: "medical",
    label: "Medical & Wellness",
    icon: Stethoscope,
    types: ["dental", "chiropractic", "med_spa", "massage"],
  },
  {
    id: "automotive",
    label: "Automotive",
    icon: Car,
    types: ["auto_repair", "auto_detailing"],
  },
  {
    id: "beauty",
    label: "Beauty & Personal",
    icon: Scissors,
    types: ["salon", "barbershop", "spa"],
  },
  {
    id: "professional",
    label: "Professional",
    icon: Briefcase,
    types: ["legal", "accounting", "real_estate", "insurance"],
  },
  {
    id: "food",
    label: "Food & Hospitality",
    icon: Utensils,
    types: ["restaurant", "catering"],
  },
];

interface Message {
  id: string;
  content: string;
  isKoya: boolean;
  component?: React.ReactNode;
  delay?: number;
}

interface ConversationFlowProps {
  businessTypes: { type_slug: string; type_name: string }[];
  onComplete: (data: {
    businessType: string;
    businessTypeName: string;
    businessName?: string;
  }) => void;
  className?: string;
}

export function ConversationFlow({
  businessTypes,
  onComplete,
  className,
}: ConversationFlowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<"greeting" | "category" | "type" | "name" | "learning" | "done">("greeting");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [isTyping, setIsTyping] = useState(true); // Start with typing indicator
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const learningCompleteRef = useRef(false);
  const initializedRef = useRef(false);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addKoyaMessage = useCallback((content: string, component?: React.ReactNode) => {
    setIsTyping(true);

    setTimeout(() => {
      setIsTyping(false);
      setMessages((prev) => [
        ...prev,
        {
          id: `koya-${Date.now()}`,
          content,
          isKoya: true,
          component,
        },
      ]);
    }, 800);
  }, []);

  // Initial greeting - only run once
  useEffect(() => {
    // Skip if already showing messages (handles StrictMode double-mount)
    if (messages.length > 0) return;

    const timer = setTimeout(() => {
      setIsTyping(false);
      setMessages([{
        id: `koya-greeting`,
        content: "Hey there! I'm Koya, your AI receptionist. I'm excited to learn about your business so I can answer calls just the way you want. Let's get you set up in under 3 minutes! What type of business do you run?",
        isKoya: true,
        component: (
          <CategorySelector
            categories={BUSINESS_CATEGORIES}
            onSelect={(id, label) => {
              setMessages((prev) => [...prev, {
                id: `user-${Date.now()}`,
                content: label,
                isKoya: false,
              }]);
              setSelectedCategory(id);
              setStep("type");
            }}
          />
        ),
      }]);
      setStep("category");
    }, 800);

    return () => clearTimeout(timer);
  }, [messages.length]);

  // Handle step transitions
  useEffect(() => {
    if (step === "type" && selectedCategory) {
      const category = BUSINESS_CATEGORIES.find((c) => c.id === selectedCategory);
      const categoryLabel = category?.label || "your";
      const availableTypes = businessTypes.filter((t) =>
        category?.types.includes(t.type_slug)
      );

      addKoyaMessage(
        `Great choice! ${categoryLabel} businesses are one of my specialties. What specific type of ${categoryLabel.toLowerCase()} business is it?`,
        <TypeSelector
          types={availableTypes}
          onSelect={(slug, name) => {
            setMessages((prev) => [...prev, {
              id: `user-${Date.now()}`,
              content: name,
              isKoya: false,
            }]);
            setSelectedType(slug);
            setStep("name");
          }}
        />
      );
    }
  }, [step, selectedCategory, businessTypes, addKoyaMessage]);

  // Handle name step
  useEffect(() => {
    if (step === "name" && selectedType) {
      const typeName = businessTypes.find((t) => t.type_slug === selectedType)?.type_name || "";

      addKoyaMessage(
        `Perfect! I know a lot about ${typeName} businesses. What's the name of your business? This is how I'll greet callers.`,
        <NameInput onSubmit={(name) => {
          setMessages((prev) => [...prev, {
            id: `user-${Date.now()}`,
            content: name,
            isKoya: false,
          }]);
          setBusinessName(name);
          setStep("learning");
        }} />
      );
    }
  }, [step, selectedType, businessTypes, addKoyaMessage]);

  // Handle learning step
  useEffect(() => {
    if (step === "learning" && businessName) {
      const typeName = businessTypes.find((t) => t.type_slug === selectedType)?.type_name || "";

      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          {
            id: `learning-${Date.now()}`,
            content: "",
            isKoya: true,
            component: (
              <LearningAnimation
                businessType={typeName}
                onComplete={() => {
                  if (learningCompleteRef.current) return;
                  learningCompleteRef.current = true;
                  setStep("done");
                }}
              />
            ),
          },
        ]);
      }, 300);
    }
  }, [step, businessName, selectedType, businessTypes]);

  // Handle done step
  useEffect(() => {
    if (step === "done" && businessName) {
      const typeName = businessTypes.find((t) => t.type_slug === selectedType)?.type_name || "";

      addKoyaMessage(
        `I'm ready! Here's how I'll answer calls for ${businessName}:`,
        <PhonePreviewMini
          greeting={`Hi, thanks for calling ${businessName}. This is Koya, how can I help you today?`}
          className="mt-2"
        />
      );

      setTimeout(() => {
        addKoyaMessage(
          "In the next step, you can customize my knowledge, add your services, and pick my voice. Ready to continue?",
          <ContinueButton
            onClick={() =>
              onComplete({
                businessType: selectedType || "",
                businessTypeName: typeName,
                businessName: businessName,
              })
            }
          />
        );
      }, 1500);
    }
  }, [step, businessName, selectedType, businessTypes, addKoyaMessage, onComplete]);

  return (
    <div className={cn("flex flex-col h-full min-h-[400px]", className)}>
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-6 space-y-4">
        {/* Typing indicator - shows while Koya is "typing" */}
        {isTyping && messages.length === 0 && (
          <ChatBubble message="" isKoya isTyping />
        )}

        <AnimatePresence mode="popLayout">
          {messages.map((message) => (
            <ChatBubble
              key={message.id}
              message={message.content}
              isKoya={message.isKoya}
            >
              {message.component}
            </ChatBubble>
          ))}
        </AnimatePresence>

        {/* Typing indicator for subsequent messages */}
        {isTyping && messages.length > 0 && (
          <ChatBubble message="" isKoya isTyping />
        )}

        <div ref={messagesEndRef} />
      </div>
    </div>
  );
}

// Category selector component
function CategorySelector({
  categories,
  onSelect,
}: {
  categories: typeof BUSINESS_CATEGORIES;
  onSelect: (id: string, label: string) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 mt-3">
      {categories.map((category) => (
        <motion.button
          key={category.id}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => onSelect(category.id, category.label)}
          className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <category.icon className="w-5 h-5 text-primary" />
          </div>
          <span className="text-sm font-medium">{category.label}</span>
        </motion.button>
      ))}

      {/* Other option */}
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => onSelect("other", "Other")}
        className="flex items-center gap-2 p-3 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left col-span-2"
      >
        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
          <Building2 className="w-5 h-5 text-muted-foreground" />
        </div>
        <span className="text-sm font-medium text-muted-foreground">Something else</span>
      </motion.button>
    </div>
  );
}

// Type selector component
function TypeSelector({
  types,
  onSelect,
}: {
  types: { type_slug: string; type_name: string }[];
  onSelect: (slug: string, name: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {types.map((type) => (
        <motion.button
          key={type.type_slug}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          onClick={() => onSelect(type.type_slug, type.type_name)}
          className="px-4 py-2 rounded-full border border-border bg-card hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium"
        >
          {type.type_name}
        </motion.button>
      ))}
    </div>
  );
}

// Name input component
function NameInput({ onSubmit }: { onSubmit: (name: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex gap-2 mt-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder="e.g., Smith's Dental, ABC Plumbing..."
        className="flex-1"
        autoFocus
      />
      <Button type="submit" disabled={!value.trim()}>
        <ChevronRight className="w-4 h-4" />
      </Button>
    </form>
  );
}

// Continue button component
function ContinueButton({ onClick }: { onClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-4"
    >
      <Button onClick={onClick} size="lg" className="w-full gap-2">
        Continue to Customize
        <ChevronRight className="w-4 h-4" />
      </Button>
    </motion.div>
  );
}
