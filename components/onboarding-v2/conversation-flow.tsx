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
import { LearningAnimation } from "./learning-animation";
import { PhonePreviewMini } from "./phone-preview";
import { ChevronRight, Building2, Briefcase, Stethoscope, Car, Utensils, Wrench, Scissors, Phone, Clock } from "lucide-react";

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

interface BusinessHoursData {
  type: "standard" | "extended" | "24_7" | "custom";
  customHours?: {
    day_of_week: number;
    open_time: string;
    close_time: string;
    is_closed: boolean;
  }[];
}

interface ConversationFlowProps {
  businessTypes: { type_slug: string; type_name: string }[];
  onComplete: (data: {
    businessType: string;
    businessTypeName: string;
    businessName?: string;
    phoneNumber?: string;
    websiteUrl?: string;
    businessHours?: BusinessHoursData;
    calendarProvider?: string;
    greeting?: string;
  }) => void;
  className?: string;
}

export function ConversationFlow({
  businessTypes,
  onComplete,
  className,
}: ConversationFlowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [step, setStep] = useState<"greeting" | "category" | "type" | "name" | "phone" | "website" | "hours" | "calendar" | "customGreeting" | "learning" | "done">("greeting");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [businessHours, setBusinessHours] = useState<BusinessHoursData | null>(null);
  const [calendarProvider, setCalendarProvider] = useState<string>("built_in");
  const [customGreeting, setCustomGreeting] = useState("");
  const [isTyping, setIsTyping] = useState(true); // Start with typing indicator
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const learningCompleteRef = useRef(false);
  const _initializedRef = useRef(false);
  // Track which steps have already been processed to prevent duplicate messages
  const processedStepsRef = useRef<Set<string>>(new Set());

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
      const stepKey = `type-${selectedCategory}`;
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      // Handle "other" category - go straight to custom input
      if (selectedCategory === "other") {
        addKoyaMessage(
          "No problem! I can work with any business. What type of business do you run?",
          <CustomTypeInput
            onSubmit={(typeName) => {
              setMessages((prev) => [...prev, {
                id: `user-${Date.now()}`,
                content: typeName,
                isKoya: false,
              }]);
              setSelectedType("other");
              // Store the custom type name for later use
              (window as any).__customTypeName = typeName;
              setStep("name");
            }}
          />
        );
        return;
      }

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
            // Store the type name for "other" case
            if (slug === "other") {
              (window as any).__customTypeName = name;
            }
            setStep("name");
          }}
        />
      );
    }
  }, [step, selectedCategory, businessTypes, addKoyaMessage]);

  // Handle name step
  useEffect(() => {
    if (step === "name" && selectedType) {
      const stepKey = `name-${selectedType}`;
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      // Get type name - use custom name for "other" types
      const typeName = selectedType === "other"
        ? ((window as any).__customTypeName || "your type of")
        : (businessTypes.find((t) => t.type_slug === selectedType)?.type_name || "");

      addKoyaMessage(
        `Perfect! I'm excited to help with ${typeName} businesses. What's the name of your business?`,
        <NameInput onSubmit={(name) => {
          setMessages((prev) => [...prev, {
            id: `user-${Date.now()}`,
            content: name,
            isKoya: false,
          }]);
          setBusinessName(name);
          setStep("phone");
        }} />
      );
    }
  }, [step, selectedType, businessTypes, addKoyaMessage]);

  // Handle phone step
  useEffect(() => {
    if (step === "phone" && businessName) {
      const stepKey = "phone";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      addKoyaMessage(
        `Great! What's your phone number? I'll use this to transfer calls to you and send SMS alerts when needed.`,
        <PhoneInput onSubmit={(phone) => {
          setMessages((prev) => [...prev, {
            id: `user-${Date.now()}`,
            content: phone,
            isKoya: false,
          }]);
          setPhoneNumber(phone);
          setStep("website");
        }} />
      );
    }
  }, [step, businessName, addKoyaMessage]);

  // Handle website step
  useEffect(() => {
    if (step === "website" && phoneNumber) {
      const stepKey = "website";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      addKoyaMessage(
        `Got it! Do you have a website? I can learn about your services, FAQs, and more from it. (You can skip this if you don't have one)`,
        <WebsiteInput onSubmit={(url) => {
          if (url) {
            setMessages((prev) => [...prev, {
              id: `user-${Date.now()}`,
              content: url,
              isKoya: false,
            }]);
            setWebsiteUrl(url);
          } else {
            setMessages((prev) => [...prev, {
              id: `user-${Date.now()}`,
              content: "I'll skip this for now",
              isKoya: false,
            }]);
          }
          setStep("hours");
        }} />
      );
    }
  }, [step, phoneNumber, addKoyaMessage]);

  // Handle business hours step
  useEffect(() => {
    if (step === "hours" && phoneNumber) {
      const stepKey = "hours";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      addKoyaMessage(
        `What are your business hours? This helps me know when to offer appointments and when to take messages.`,
        <BusinessHoursInput onSubmit={(hours) => {
          const hoursLabel = hours.type === "standard" ? "Mon-Fri, 9am-5pm" :
            hours.type === "extended" ? "Mon-Fri, 8am-6pm & Sat 9am-1pm" :
            hours.type === "24_7" ? "24/7" : "Custom hours";
          setMessages((prev) => [...prev, {
            id: `user-${Date.now()}`,
            content: hoursLabel,
            isKoya: false,
          }]);
          setBusinessHours(hours);
          setStep("calendar");
        }} />
      );
    }
  }, [step, phoneNumber, addKoyaMessage]);

  // Handle calendar step
  useEffect(() => {
    if (step === "calendar" && businessHours) {
      const stepKey = "calendar";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      addKoyaMessage(
        `Would you like to connect a calendar? This lets me check your real availability and book appointments directly.`,
        <CalendarInput onSubmit={(provider) => {
          const providerLabel = provider === "google" ? "Google Calendar" :
            provider === "outlook" ? "Microsoft Outlook" : "Koya's built-in scheduler";
          setMessages((prev) => [...prev, {
            id: `user-${Date.now()}`,
            content: providerLabel,
            isKoya: false,
          }]);
          setCalendarProvider(provider);
          setStep("customGreeting");
        }} />
      );
    }
  }, [step, businessHours, addKoyaMessage]);

  // Handle greeting step
  useEffect(() => {
    if (step === "customGreeting" && calendarProvider) {
      const stepKey = "customGreeting";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      const defaultGreeting = `Hi, thanks for calling ${businessName}. This is Koya, how can I help you today?`;

      addKoyaMessage(
        `Almost done! Let's set up how I'll greet your callers. Here's a suggested greeting - feel free to customize it:`,
        <GreetingInput
          defaultGreeting={defaultGreeting}
          onSubmit={(greeting) => {
            setMessages((prev) => [...prev, {
              id: `user-${Date.now()}`,
              content: `"${greeting}"`,
              isKoya: false,
            }]);
            setCustomGreeting(greeting);
            setStep("learning");
          }}
        />
      );
    }
  }, [step, businessName, calendarProvider, addKoyaMessage]);

  // Handle learning step
  useEffect(() => {
    if (step === "learning" && customGreeting) {
      const stepKey = "learning";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      const typeName = selectedType === "other"
        ? ((window as any).__customTypeName || "your")
        : (businessTypes.find((t) => t.type_slug === selectedType)?.type_name || "");

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
                websiteUrl={websiteUrl}
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
  }, [step, customGreeting, selectedType, businessTypes, websiteUrl]);

  // Handle done step
  useEffect(() => {
    if (step === "done" && customGreeting) {
      const stepKey = "done";
      if (processedStepsRef.current.has(stepKey)) return;
      processedStepsRef.current.add(stepKey);

      const typeName = selectedType === "other"
        ? ((window as any).__customTypeName || "your business")
        : (businessTypes.find((t) => t.type_slug === selectedType)?.type_name || "");

      addKoyaMessage(
        `I'm ready! Here's how I'll answer calls for ${businessName}:`,
        <PhonePreviewMini
          greeting={customGreeting}
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
                phoneNumber: phoneNumber || undefined,
                websiteUrl: websiteUrl || undefined,
                businessHours: businessHours || undefined,
                calendarProvider: calendarProvider || undefined,
                greeting: customGreeting,
              })
            }
          />
        );
      }, 1500);
    }
  }, [step, customGreeting, businessName, phoneNumber, selectedType, businessTypes, websiteUrl, businessHours, calendarProvider, addKoyaMessage, onComplete]);

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
  const [showOtherInput, setShowOtherInput] = useState(false);
  const [otherValue, setOtherValue] = useState("");

  const handleOtherSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (otherValue.trim()) {
      onSelect("other", otherValue.trim());
    }
  };

  if (showOtherInput) {
    return (
      <form onSubmit={handleOtherSubmit} className="mt-3">
        <p className="text-sm text-muted-foreground mb-2">Tell me what type of business you run:</p>
        <div className="flex gap-2">
          <Input
            value={otherValue}
            onChange={(e) => setOtherValue(e.target.value)}
            placeholder="e.g., Physical Therapy, Acupuncture..."
            className="flex-1"
            autoFocus
          />
          <Button type="submit" disabled={!otherValue.trim()}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <button
          type="button"
          onClick={() => setShowOtherInput(false)}
          className="text-xs text-muted-foreground hover:text-foreground mt-2"
        >
          ← Back to options
        </button>
      </form>
    );
  }

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
      {/* Other option */}
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setShowOtherInput(true)}
        className="px-4 py-2 rounded-full border border-dashed border-muted-foreground/50 bg-card hover:border-primary hover:bg-primary/5 transition-colors text-sm font-medium text-muted-foreground"
      >
        Other...
      </motion.button>
    </div>
  );
}

// Custom type input for "Other" category
function CustomTypeInput({ onSubmit }: { onSubmit: (typeName: string) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="e.g., Physical Therapy, Pet Grooming, Fitness Studio..."
          className="flex-1"
          autoFocus
        />
        <Button type="submit" disabled={!value.trim()}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </form>
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

// Phone input component
function PhoneInput({ onSubmit }: { onSubmit: (phone: string) => void }) {
  const [value, setValue] = useState("");

  // Format phone number as user types
  const formatPhone = (input: string) => {
    // Remove all non-digits
    const digits = input.replace(/\D/g, "");

    // Format as (XXX) XXX-XXXX
    if (digits.length <= 3) {
      return digits;
    } else if (digits.length <= 6) {
      return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    } else {
      return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setValue(formatted);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const digits = value.replace(/\D/g, "");
    if (digits.length >= 10) {
      onSubmit(value);
    }
  };

  const isValid = value.replace(/\D/g, "").length >= 10;

  return (
    <form onSubmit={handleSubmit} className="mt-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={value}
            onChange={handleChange}
            placeholder="(555) 123-4567"
            className="pl-10"
            type="tel"
            autoFocus
          />
        </div>
        <Button type="submit" disabled={!isValid}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground mt-2">
        For call transfers and SMS notifications
      </p>
    </form>
  );
}

// Website input component
function WebsiteInput({ onSubmit }: { onSubmit: (url: string | null) => void }) {
  const [value, setValue] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Add https:// if no protocol specified
    let url = value.trim();
    if (url && !url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    onSubmit(url || null);
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-2">
      <div className="flex gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="www.yourbusiness.com"
          className="flex-1"
          autoFocus
        />
        <Button type="submit">
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <button
        type="button"
        onClick={() => onSubmit(null)}
        className="text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Skip - I don&apos;t have a website
      </button>
    </form>
  );
}

// Greeting input component
function GreetingInput({
  defaultGreeting,
  onSubmit
}: {
  defaultGreeting: string;
  onSubmit: (greeting: string) => void;
}) {
  const [value, setValue] = useState(defaultGreeting);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onSubmit(value.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-3 space-y-3">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="w-full p-3 rounded-lg border border-border bg-card text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
        rows={3}
        autoFocus
      />
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setValue(defaultGreeting)}
          className="text-xs"
        >
          Reset to default
        </Button>
        <Button type="submit" size="sm" className="ml-auto gap-1">
          Use this greeting
          <ChevronRight className="w-3 h-3" />
        </Button>
      </div>
    </form>
  );
}

// Business hours input component
function BusinessHoursInput({ onSubmit }: { onSubmit: (hours: BusinessHoursData) => void }) {
  const options = [
    {
      type: "standard" as const,
      label: "Standard (Mon-Fri, 9am-5pm)",
      description: "Closed on weekends",
    },
    {
      type: "extended" as const,
      label: "Extended Hours",
      description: "Mon-Fri 8am-6pm, Sat 9am-1pm",
    },
    {
      type: "24_7" as const,
      label: "24/7",
      description: "Always available",
    },
    {
      type: "custom" as const,
      label: "Custom Hours",
      description: "Set specific hours later",
    },
  ];

  return (
    <div className="mt-3 space-y-2">
      {options.map((option) => (
        <motion.button
          key={option.type}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSubmit({ type: option.type })}
          className="w-full flex items-center gap-3 p-3 rounded-lg border border-border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left"
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{option.label}</p>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.button>
      ))}
    </div>
  );
}

// Calendar input component
function CalendarInput({ onSubmit }: { onSubmit: (provider: string) => void }) {
  const options = [
    {
      provider: "google",
      label: "Google Calendar",
      description: "Connect in settings after setup",
      icon: "🗓️",
    },
    {
      provider: "outlook",
      label: "Microsoft Outlook",
      description: "Connect in settings after setup",
      icon: "📅",
    },
    {
      provider: "built_in",
      label: "Use Koya's Scheduler",
      description: "Based on your business hours",
      icon: "✨",
      recommended: true,
    },
  ];

  return (
    <div className="mt-3 space-y-2">
      {options.map((option) => (
        <motion.button
          key={option.provider}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.99 }}
          onClick={() => onSubmit(option.provider)}
          className={cn(
            "w-full flex items-center gap-3 p-3 rounded-lg border bg-card hover:border-primary/50 hover:bg-primary/5 transition-colors text-left",
            option.recommended ? "border-primary/30" : "border-border"
          )}
        >
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 text-lg">
            {option.icon}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <p className="font-medium text-sm">{option.label}</p>
              {option.recommended && (
                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">
                  Recommended
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{option.description}</p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.button>
      ))}
    </div>
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
