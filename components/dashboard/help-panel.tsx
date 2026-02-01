"use client";

/**
 * Help Panel Component
 * Slide-out panel for in-app help system
 */

import { useState, useMemo } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Search,
  BookOpen,
  Settings,
  Calendar,
  Phone,
  MessageSquare,
  Headphones,
  ExternalLink,
  ChevronRight,
  HelpCircle,
  Mic,
  Brain,
  Bell,
} from "lucide-react";

interface HelpPanelProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface HelpArticle {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
  link: string;
}

export function HelpPanel({ open, onOpenChange }: HelpPanelProps) {
  const t = useTranslations("help");
  const pathname = usePathname();
  const [searchQuery, setSearchQuery] = useState("");

  // Define help articles
  const helpArticles: HelpArticle[] = useMemo(
    () => [
      {
        id: "getting-started",
        title: t("articles.gettingStarted.title"),
        description: t("articles.gettingStarted.description"),
        category: "getting-started",
        icon: <BookOpen className="h-4 w-4" />,
        link: "/help#getting-started",
      },
      {
        id: "setup-voice",
        title: t("articles.setupVoice.title"),
        description: t("articles.setupVoice.description"),
        category: "features",
        icon: <Mic className="h-4 w-4" />,
        link: "/help#voice-settings",
      },
      {
        id: "knowledge-base",
        title: t("articles.knowledgeBase.title"),
        description: t("articles.knowledgeBase.description"),
        category: "features",
        icon: <Brain className="h-4 w-4" />,
        link: "/help#knowledge-base",
      },
      {
        id: "calendar-sync",
        title: t("articles.calendarSync.title"),
        description: t("articles.calendarSync.description"),
        category: "integrations",
        icon: <Calendar className="h-4 w-4" />,
        link: "/help#calendar-integration",
      },
      {
        id: "call-handling",
        title: t("articles.callHandling.title"),
        description: t("articles.callHandling.description"),
        category: "features",
        icon: <Phone className="h-4 w-4" />,
        link: "/help#call-handling",
      },
      {
        id: "notifications",
        title: t("articles.notifications.title"),
        description: t("articles.notifications.description"),
        category: "features",
        icon: <Bell className="h-4 w-4" />,
        link: "/help#notifications",
      },
    ],
    [t]
  );

  // Get contextual help based on current page
  const contextualHelp = useMemo(() => {
    if (pathname.includes("/settings")) {
      return helpArticles.filter(
        (a) =>
          a.id === "setup-voice" ||
          a.id === "call-handling" ||
          a.id === "notifications"
      );
    }
    if (pathname.includes("/knowledge")) {
      return helpArticles.filter(
        (a) => a.id === "knowledge-base" || a.id === "getting-started"
      );
    }
    if (pathname.includes("/appointments") || pathname.includes("/calendar")) {
      return helpArticles.filter(
        (a) => a.id === "calendar-sync" || a.id === "getting-started"
      );
    }
    if (pathname.includes("/calls")) {
      return helpArticles.filter(
        (a) => a.id === "call-handling" || a.id === "getting-started"
      );
    }
    return helpArticles.slice(0, 3);
  }, [pathname, helpArticles]);

  // Filter articles based on search
  const filteredArticles = useMemo(() => {
    if (!searchQuery) return [];
    const query = searchQuery.toLowerCase();
    return helpArticles.filter(
      (article) =>
        article.title.toLowerCase().includes(query) ||
        article.description.toLowerCase().includes(query)
    );
  }, [searchQuery, helpArticles]);

  // Quick links
  const quickLinks = [
    {
      title: t("quickLinks.viewAllHelp"),
      icon: <BookOpen className="h-4 w-4" />,
      href: "/help",
    },
    {
      title: t("quickLinks.settings"),
      icon: <Settings className="h-4 w-4" />,
      href: "/settings",
    },
    {
      title: t("quickLinks.contactSupport"),
      icon: <Headphones className="h-4 w-4" />,
      href: "#contact-support",
      action: true,
    },
  ];

  const [showContactForm, setShowContactForm] = useState(false);
  const [contactMessage, setContactMessage] = useState("");
  const [contactSubmitted, setContactSubmitted] = useState(false);

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // In a real app, this would send the message to support
    setContactSubmitted(true);
    setTimeout(() => {
      setContactSubmitted(false);
      setShowContactForm(false);
      setContactMessage("");
    }, 2000);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader className="space-y-1">
          <SheetTitle className="flex items-center gap-2">
            <HelpCircle className="h-5 w-5 text-primary" />
            {t("panelTitle")}
          </SheetTitle>
          <SheetDescription>{t("panelDescription")}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>

          {/* Search Results */}
          {searchQuery && filteredArticles.length > 0 && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("searchResults")}
              </h3>
              <div className="space-y-1">
                {filteredArticles.map((article) => (
                  <a
                    key={article.id}
                    href={article.link}
                    onClick={() => onOpenChange(false)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="mt-0.5 text-muted-foreground">
                      {article.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{article.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {article.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {searchQuery && filteredArticles.length === 0 && (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground">{t("noResults")}</p>
            </div>
          )}

          {/* Contextual Help */}
          {!searchQuery && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("contextualHelp")}
              </h3>
              <div className="space-y-1">
                {contextualHelp.map((article) => (
                  <a
                    key={article.id}
                    href={article.link}
                    onClick={() => onOpenChange(false)}
                    className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted transition-colors"
                  >
                    <div className="mt-0.5 text-primary">{article.icon}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{article.title}</p>
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {article.description}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground mt-0.5" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* Quick Links */}
          {!searchQuery && (
            <div className="space-y-2">
              <h3 className="text-sm font-medium text-muted-foreground">
                {t("quickLinks.title")}
              </h3>
              <div className="grid gap-2">
                {quickLinks.map((link, index) =>
                  link.action ? (
                    <button
                      key={index}
                      onClick={() => setShowContactForm(true)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left w-full"
                    >
                      <div className="text-primary">{link.icon}</div>
                      <span className="text-sm font-medium">{link.title}</span>
                    </button>
                  ) : (
                    <a
                      key={index}
                      href={link.href}
                      onClick={() => onOpenChange(false)}
                      className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors"
                    >
                      <div className="text-primary">{link.icon}</div>
                      <span className="text-sm font-medium">{link.title}</span>
                      <ExternalLink className="h-3 w-3 text-muted-foreground ml-auto" />
                    </a>
                  )
                )}
              </div>
            </div>
          )}

          {/* Contact Support Form */}
          {showContactForm && (
            <div className="space-y-4 p-4 bg-muted rounded-lg">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium">{t("contactSupport.title")}</h3>
                <button
                  onClick={() => setShowContactForm(false)}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  {t("contactSupport.cancel")}
                </button>
              </div>

              {contactSubmitted ? (
                <div className="text-center py-4">
                  <MessageSquare className="h-8 w-8 text-primary mx-auto mb-2" />
                  <p className="text-sm font-medium">{t("contactSupport.submitted")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("contactSupport.submittedDescription")}
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-3">
                  <textarea
                    placeholder={t("contactSupport.placeholder")}
                    value={contactMessage}
                    onChange={(e) => setContactMessage(e.target.value)}
                    className="w-full min-h-[100px] p-3 text-sm rounded-md border border-input bg-background resize-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    required
                  />
                  <Button type="submit" size="sm" className="w-full">
                    {t("contactSupport.send")}
                  </Button>
                </form>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
