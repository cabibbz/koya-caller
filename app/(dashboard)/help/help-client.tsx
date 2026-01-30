"use client";

/**
 * Help Center Client Component
 * Searchable FAQ and help articles with categories
 */

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { APP_CONFIG } from "@/lib/config";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Search,
  BookOpen,
  Settings,
  Phone,
  Headphones,
  ChevronDown,
  ChevronUp,
  Zap,
  AlertTriangle,
  HelpCircle,
  MessageSquare,
} from "lucide-react";

interface HelpArticle {
  id: string;
  question: string;
  answer: string;
  category: "getting-started" | "features" | "integrations" | "troubleshooting";
}

const categoryIcons = {
  "getting-started": <BookOpen className="h-5 w-5" />,
  features: <Zap className="h-5 w-5" />,
  integrations: <Settings className="h-5 w-5" />,
  troubleshooting: <AlertTriangle className="h-5 w-5" />,
};

export function HelpClient() {
  const t = useTranslations("help");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [expandedArticles, setExpandedArticles] = useState<Set<string>>(
    new Set()
  );

  // Help articles data
  const helpArticles: HelpArticle[] = useMemo(
    () => [
      // Getting Started
      {
        id: "what-is-koya",
        question: t("faq.whatIsKoya.question"),
        answer: t("faq.whatIsKoya.answer"),
        category: "getting-started",
      },
      {
        id: "how-to-start",
        question: t("faq.howToStart.question"),
        answer: t("faq.howToStart.answer"),
        category: "getting-started",
      },
      {
        id: "phone-number",
        question: t("faq.phoneNumber.question"),
        answer: t("faq.phoneNumber.answer"),
        category: "getting-started",
      },
      {
        id: "test-call",
        question: t("faq.testCall.question"),
        answer: t("faq.testCall.answer"),
        category: "getting-started",
      },
      // Features
      {
        id: "voice-settings",
        question: t("faq.voiceSettings.question"),
        answer: t("faq.voiceSettings.answer"),
        category: "features",
      },
      {
        id: "knowledge-base",
        question: t("faq.knowledgeBase.question"),
        answer: t("faq.knowledgeBase.answer"),
        category: "features",
      },
      {
        id: "call-handling",
        question: t("faq.callHandling.question"),
        answer: t("faq.callHandling.answer"),
        category: "features",
      },
      {
        id: "notifications",
        question: t("faq.notifications.question"),
        answer: t("faq.notifications.answer"),
        category: "features",
      },
      {
        id: "spanish-support",
        question: t("faq.spanishSupport.question"),
        answer: t("faq.spanishSupport.answer"),
        category: "features",
      },
      // Integrations
      {
        id: "calendar-integration",
        question: t("faq.calendarIntegration.question"),
        answer: t("faq.calendarIntegration.answer"),
        category: "integrations",
      },
      {
        id: "google-calendar",
        question: t("faq.googleCalendar.question"),
        answer: t("faq.googleCalendar.answer"),
        category: "integrations",
      },
      {
        id: "sms-notifications",
        question: t("faq.smsNotifications.question"),
        answer: t("faq.smsNotifications.answer"),
        category: "integrations",
      },
      // Troubleshooting
      {
        id: "calls-not-working",
        question: t("faq.callsNotWorking.question"),
        answer: t("faq.callsNotWorking.answer"),
        category: "troubleshooting",
      },
      {
        id: "appointments-not-syncing",
        question: t("faq.appointmentsNotSyncing.question"),
        answer: t("faq.appointmentsNotSyncing.answer"),
        category: "troubleshooting",
      },
      {
        id: "voice-quality",
        question: t("faq.voiceQuality.question"),
        answer: t("faq.voiceQuality.answer"),
        category: "troubleshooting",
      },
    ],
    [t]
  );

  const categories = [
    {
      id: "getting-started",
      label: t("categories.gettingStarted"),
      icon: categoryIcons["getting-started"],
    },
    {
      id: "features",
      label: t("categories.features"),
      icon: categoryIcons["features"],
    },
    {
      id: "integrations",
      label: t("categories.integrations"),
      icon: categoryIcons["integrations"],
    },
    {
      id: "troubleshooting",
      label: t("categories.troubleshooting"),
      icon: categoryIcons["troubleshooting"],
    },
  ];

  // Filter articles based on search and category
  const filteredArticles = useMemo(() => {
    let articles = helpArticles;

    if (activeCategory) {
      articles = articles.filter((a) => a.category === activeCategory);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      articles = articles.filter(
        (a) =>
          a.question.toLowerCase().includes(query) ||
          a.answer.toLowerCase().includes(query)
      );
    }

    return articles;
  }, [helpArticles, activeCategory, searchQuery]);

  const toggleArticle = (id: string) => {
    setExpandedArticles((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const getCategoryIcon = (category: string) => {
    return categoryIcons[category as keyof typeof categoryIcons] || (
      <HelpCircle className="h-5 w-5" />
    );
  };

  return (
    <div className="p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t("pageTitle")}</h1>
        <p className="text-muted-foreground mt-1">{t("pageDescription")}</p>
      </div>

      {/* Search */}
      <div className="relative mb-8">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
        <Input
          placeholder={t("searchPlaceholder")}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-12 h-12 text-base"
        />
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        <Button
          variant={activeCategory === null ? "default" : "outline"}
          size="sm"
          onClick={() => setActiveCategory(null)}
        >
          {t("allCategories")}
        </Button>
        {categories.map((cat) => (
          <Button
            key={cat.id}
            variant={activeCategory === cat.id ? "default" : "outline"}
            size="sm"
            onClick={() => setActiveCategory(cat.id)}
            className="gap-2"
          >
            {cat.icon}
            {cat.label}
          </Button>
        ))}
      </div>

      {/* Articles */}
      {filteredArticles.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <HelpCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium">{t("noResults")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("noResultsDescription")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredArticles.map((article) => (
            <Card
              key={article.id}
              id={article.id}
              className="overflow-hidden"
            >
              <button
                onClick={() => toggleArticle(article.id)}
                className="w-full text-left"
              >
                <CardHeader className="flex flex-row items-center gap-4 py-4">
                  <div className="text-primary">
                    {getCategoryIcon(article.category)}
                  </div>
                  <div className="flex-1">
                    <CardTitle className="text-base font-medium">
                      {article.question}
                    </CardTitle>
                    {!expandedArticles.has(article.id) && (
                      <CardDescription className="line-clamp-1 mt-1">
                        {article.answer}
                      </CardDescription>
                    )}
                  </div>
                  <div className="text-muted-foreground">
                    {expandedArticles.has(article.id) ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </div>
                </CardHeader>
              </button>
              {expandedArticles.has(article.id) && (
                <CardContent className="pt-0 pb-4">
                  <div className="pl-9 text-sm text-muted-foreground whitespace-pre-line">
                    {article.answer}
                  </div>
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Contact Support Section */}
      <Card className="mt-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Headphones className="h-5 w-5 text-primary" />
            {t("contactSupport.title")}
          </CardTitle>
          <CardDescription>{t("contactSupport.description")}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <MessageSquare className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">{t("contactSupport.email.title")}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("contactSupport.email.description")}
                </p>
                <a
                  href={`mailto:${APP_CONFIG.contact.support}`}
                  className="text-sm text-primary hover:underline mt-2 inline-block"
                >
                  {APP_CONFIG.contact.support}
                </a>
              </div>
            </div>
            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted">
              <Phone className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <h4 className="font-medium text-sm">{t("contactSupport.phone.title")}</h4>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("contactSupport.phone.description")}
                </p>
                <p className="text-sm text-primary mt-2">
                  {t("contactSupport.phone.hours")}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
