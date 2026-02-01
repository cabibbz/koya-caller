"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Loader2,
  Mail,
  Send,
  Search,
  RefreshCw,
  Star,
  Paperclip,
  Inbox,
  X,
  Reply,
  ChevronLeft,
  Plus,
  Sparkles,
  ChevronDown,
  Archive,
  Trash2,
  MoreHorizontal,
  Check,
  MailOpen,
  Forward,
  Clock,
  ArrowLeft,
  Pen,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const PURIFY_CONFIG = {
  ALLOWED_TAGS: [
    "p", "br", "b", "i", "u", "strong", "em", "a", "ul", "ol", "li",
    "h1", "h2", "h3", "h4", "h5", "h6", "blockquote", "pre", "code",
    "table", "thead", "tbody", "tr", "th", "td", "div", "span", "img", "hr",
  ],
  ALLOWED_ATTR: ["href", "src", "alt", "class", "style", "target", "rel", "width", "height"],
  ALLOW_DATA_ATTR: false,
  ADD_ATTR: ["target"],
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "textarea", "select"],
};

interface EmailMessage {
  id: string;
  subject: string;
  from: Array<{ name: string; email: string }>;
  to: Array<{ name: string; email: string }>;
  cc?: Array<{ name: string; email: string }>;
  date: number;
  unread: boolean;
  starred: boolean;
  snippet: string;
  body: string;
  hasAttachments: boolean;
  archived?: boolean;
}

// Get initials for avatar
const getInitials = (name: string, email: string) => {
  if (name && name.trim()) {
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name[0].toUpperCase();
  }
  return email[0]?.toUpperCase() || "?";
};

// Generate consistent color from string
const getAvatarColor = (str: string) => {
  const colors = [
    "bg-gradient-to-br from-blue-500 to-blue-600",
    "bg-gradient-to-br from-emerald-500 to-emerald-600",
    "bg-gradient-to-br from-violet-500 to-violet-600",
    "bg-gradient-to-br from-rose-500 to-rose-600",
    "bg-gradient-to-br from-amber-500 to-amber-600",
    "bg-gradient-to-br from-cyan-500 to-cyan-600",
    "bg-gradient-to-br from-fuchsia-500 to-fuchsia-600",
    "bg-gradient-to-br from-indigo-500 to-indigo-600",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
};

// Smart date formatting
const formatDate = (unix: number) => {
  const d = new Date(unix * 1000);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24 && d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  }
  if (diffHours < 48) return "Yesterday";
  if (d.getFullYear() === now.getFullYear()) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  }
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "2-digit" });
};

const formatFullDate = (unix: number) => {
  return new Date(unix * 1000).toLocaleString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

export function InboxClient() {
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [showCompose, setShowCompose] = useState(false);
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSelectionMode, setIsSelectionMode] = useState(false);

  // Compose state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);

  // AI Generation state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "friendly" | "casual" | "urgent">("professional");
  const [aiPurpose, setAiPurpose] = useState<"marketing" | "follow_up" | "reminder" | "announcement" | "thank_you" | "general">("general");
  const [generatingAi, setGeneratingAi] = useState(false);

  // Touch gesture state
  const touchStartX = useRef<number>(0);
  const touchCurrentX = useRef<number>(0);
  const [swipingId, setSwipingId] = useState<string | null>(null);
  const [swipeOffset, setSwipeOffset] = useState(0);

  // Fetch messages
  const fetchMessages = useCallback(async (searchQuery?: string, newOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50", offset: String(newOffset) });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/dashboard/inbox?${params}`);
      const json = await res.json();

      if (!res.ok) {
        const errorMsg = typeof json.error === 'string'
          ? json.error
          : json.error?.message || json.message || "Failed to load inbox";
        setError(errorMsg);
        setMessages([]);
        return;
      }

      setMessages(json.messages || []);
      setOffset(newOffset);
    } catch {
      setError("Failed to load inbox");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  const handleSearch = () => {
    fetchMessages(search, 0);
  };

  const openMessage = async (msg: EmailMessage) => {
    if (isSelectionMode) {
      toggleSelect(msg.id);
      return;
    }

    setLoadingMessage(true);
    setSelectedMessage(msg);
    setMobileView("detail");
    try {
      const res = await fetch(`/api/dashboard/inbox/${msg.id}`);
      const json = await res.json();
      setSelectedMessage(json);

      // Mark as read in the list
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m))
      );
    } catch {
      // Keep the preview version
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleCompose = (replyTo?: EmailMessage) => {
    if (replyTo) {
      const fromAddr = replyTo.from[0];
      setComposeTo(fromAddr?.email || "");
      setComposeSubject(`Re: ${replyTo.subject}`);
      setComposeBody("");
      setReplyToId(replyTo.id);
    } else {
      setComposeTo("");
      setComposeSubject("");
      setComposeBody("");
      setReplyToId(undefined);
    }
    setShowAiPanel(false);
    setAiPrompt("");
    setShowCompose(true);
  };

  const handleGenerateAi = async () => {
    if (!aiPrompt.trim() || aiPrompt.trim().length < 10) {
      toast({
        title: "Description needed",
        description: "Please describe what you want the email to say (at least 10 characters)",
        variant: "destructive",
      });
      return;
    }

    setGeneratingAi(true);
    try {
      const response = await fetch("/api/dashboard/ai/generate-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: aiPrompt,
          tone: aiTone,
          purpose: aiPurpose,
          includeCallToAction: true,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to generate email");
      }

      setComposeSubject(result.subject);
      setComposeBody(result.body);
      setShowAiPanel(false);
      setAiPrompt("");

      toast({
        title: "Email generated",
        description: "AI has created your email. Feel free to edit it.",
        variant: "success",
      });
    } catch (error) {
      toast({
        title: "Generation failed",
        description: error instanceof Error ? error.message : "Could not generate email",
        variant: "destructive",
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleSend = async () => {
    if (!composeTo || !composeSubject) return;
    setSending(true);
    try {
      const res = await fetch("/api/dashboard/inbox/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: [{ email: composeTo }],
          subject: composeSubject,
          body: composeBody,
          replyToMessageId: replyToId,
        }),
      });

      if (res.ok) {
        setShowCompose(false);
        toast({
          title: "Email sent",
          description: "Your message has been sent successfully.",
          variant: "success",
        });
        fetchMessages(search, 0);
      }
    } finally {
      setSending(false);
    }
  };

  const toggleStar = async (msg: EmailMessage, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/dashboard/inbox/${msg.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred: !msg.starred }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, starred: !m.starred } : m))
      );
      if (selectedMessage?.id === msg.id) {
        setSelectedMessage({ ...selectedMessage, starred: !msg.starred });
      }
    } catch {
      // Ignore
    }
  };

  const archiveMessage = async (msgId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/dashboard/inbox/${msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: true }),
      });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
        setMobileView("list");
      }
      toast({ title: "Archived", description: "Message has been archived." });
    } catch {
      toast({ title: "Error", description: "Failed to archive message.", variant: "destructive" });
    }
  };

  const deleteMessage = async (msgId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    try {
      await fetch(`/api/dashboard/inbox/${msgId}`, {
        method: "DELETE",
      });
      setMessages((prev) => prev.filter((m) => m.id !== msgId));
      if (selectedMessage?.id === msgId) {
        setSelectedMessage(null);
        setMobileView("list");
      }
      toast({ title: "Deleted", description: "Message has been deleted." });
    } catch {
      toast({ title: "Error", description: "Failed to delete message.", variant: "destructive" });
    }
  };

  const markAsRead = async (msgId: string, read: boolean) => {
    try {
      await fetch(`/api/dashboard/inbox/${msgId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ unread: !read }),
      });
      setMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, unread: !read } : m))
      );
    } catch {
      // Ignore
    }
  };

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      if (next.size === 0) {
        setIsSelectionMode(false);
      }
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
      setIsSelectionMode(false);
    } else {
      setSelectedIds(new Set(messages.map((m) => m.id)));
    }
  };

  const bulkArchive = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await archiveMessage(id);
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const bulkDelete = async () => {
    const ids = Array.from(selectedIds);
    for (const id of ids) {
      await deleteMessage(id);
    }
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  // Touch gesture handlers for swipe
  const handleTouchStart = (e: React.TouchEvent, msgId: string) => {
    touchStartX.current = e.touches[0].clientX;
    touchCurrentX.current = e.touches[0].clientX;
    setSwipingId(msgId);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipingId) return;
    touchCurrentX.current = e.touches[0].clientX;
    const diff = touchCurrentX.current - touchStartX.current;
    // Only allow left swipe (negative values), cap at -120
    if (diff < 0) {
      setSwipeOffset(Math.max(diff, -120));
    }
  };

  const handleTouchEnd = () => {
    if (!swipingId) return;
    // If swiped more than 80px, trigger archive
    if (swipeOffset < -80) {
      archiveMessage(swipingId);
    }
    setSwipingId(null);
    setSwipeOffset(0);
  };

  return (
    <TooltipProvider>
      <div className="h-[calc(100vh-4rem)] flex flex-col p-4 gap-4">
        {/* Compose Modal */}
        {showCompose && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
            <div className="bg-background rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[95vh] sm:max-h-[85vh] flex flex-col animate-in slide-in-from-bottom-4 duration-300">
              {/* Compose Header */}
              <div className="flex items-center justify-between px-4 sm:px-6 py-4 border-b">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Pen className="w-4 h-4 text-primary" />
                  </div>
                  <h2 className="font-semibold text-lg">{replyToId ? "Reply" : "New Message"}</h2>
                </div>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setShowCompose(false)}>
                  <X className="w-5 h-5" />
                </Button>
              </div>

              <div className="flex-1 overflow-auto px-4 sm:px-6 py-4 space-y-4">
                {/* AI Generation Panel */}
                {!replyToId && (
                  <div className="rounded-xl border overflow-hidden bg-gradient-to-br from-violet-50/50 to-blue-50/50 dark:from-violet-950/20 dark:to-blue-950/20">
                    <button
                      type="button"
                      onClick={() => setShowAiPanel(!showAiPanel)}
                      className="w-full flex items-center justify-between p-4 hover:bg-white/50 dark:hover:bg-white/5 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-blue-500 flex items-center justify-center">
                          <Sparkles className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-left">
                          <span className="font-medium text-sm">Write with AI</span>
                          <p className="text-xs text-muted-foreground">Let AI draft your email</p>
                        </div>
                      </div>
                      <ChevronDown className={cn("w-5 h-5 text-muted-foreground transition-transform", showAiPanel && "rotate-180")} />
                    </button>

                    {showAiPanel && (
                      <div className="px-4 pb-4 space-y-4 border-t bg-white/30 dark:bg-black/10">
                        <div className="pt-4">
                          <Label className="text-sm font-medium">What should this email say?</Label>
                          <Textarea
                            placeholder="e.g., Thank the customer for their business and let them know about our holiday hours..."
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            rows={3}
                            className="mt-2 bg-background"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <Label className="text-sm font-medium">Tone</Label>
                            <Select value={aiTone} onValueChange={(v) => setAiTone(v as typeof aiTone)}>
                              <SelectTrigger className="mt-1.5 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="professional">Professional</SelectItem>
                                <SelectItem value="friendly">Friendly</SelectItem>
                                <SelectItem value="casual">Casual</SelectItem>
                                <SelectItem value="urgent">Urgent</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div>
                            <Label className="text-sm font-medium">Purpose</Label>
                            <Select value={aiPurpose} onValueChange={(v) => setAiPurpose(v as typeof aiPurpose)}>
                              <SelectTrigger className="mt-1.5 bg-background">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="general">General</SelectItem>
                                <SelectItem value="marketing">Marketing</SelectItem>
                                <SelectItem value="follow_up">Follow Up</SelectItem>
                                <SelectItem value="reminder">Reminder</SelectItem>
                                <SelectItem value="announcement">Announcement</SelectItem>
                                <SelectItem value="thank_you">Thank You</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <Button
                          type="button"
                          onClick={handleGenerateAi}
                          disabled={generatingAi || aiPrompt.trim().length < 10}
                          className="w-full bg-gradient-to-r from-violet-500 to-blue-500 hover:from-violet-600 hover:to-blue-600"
                        >
                          {generatingAi ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 mr-2" />
                              Generate Email
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                {/* Email Fields */}
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">To</Label>
                  <Input
                    type="email"
                    placeholder="recipient@example.com"
                    value={composeTo}
                    onChange={(e) => setComposeTo(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Subject</Label>
                  <Input
                    placeholder="Email subject"
                    value={composeSubject}
                    onChange={(e) => setComposeSubject(e.target.value)}
                    className="h-11"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-sm text-muted-foreground">Message</Label>
                  <Textarea
                    placeholder="Write your message..."
                    value={composeBody}
                    onChange={(e) => setComposeBody(e.target.value)}
                    className="min-h-[200px] resize-none"
                  />
                </div>
              </div>

              {/* Compose Footer */}
              <div className="flex justify-between items-center px-4 sm:px-6 py-4 border-t bg-muted/30">
                <Button variant="ghost" onClick={() => setShowCompose(false)}>
                  Discard
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!composeTo || !composeSubject || sending}
                  className="min-w-[100px]"
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Main Layout */}
        <div className="flex-1 flex overflow-hidden border rounded-lg bg-background">
          {/* Message List */}
          <div className={cn(
            "w-full border-r flex-shrink-0 flex flex-col bg-background transition-all duration-300",
            // When no message selected, take full width. When message selected, be narrower
            selectedMessage ? "md:w-[380px] lg:w-[420px]" : "md:flex-1",
            mobileView !== "list" && "hidden md:flex"
          )}>
            {/* Header */}
            <div className="p-4 border-b bg-background">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-xl font-semibold">Inbox</h1>
                <div className="flex items-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9"
                        onClick={() => fetchMessages(search, 0)}
                        disabled={loading}
                      >
                        <RefreshCw className={cn("w-4 h-4", loading && "animate-spin")} />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Refresh</TooltipContent>
                  </Tooltip>
                  <Button onClick={() => handleCompose()} className="h-9 gap-2">
                    <Plus className="w-4 h-4" />
                    <span className="hidden sm:inline">Compose</span>
                  </Button>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search emails..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-10 h-10 bg-muted/50"
                />
              </div>

              {/* Bulk Actions Bar */}
              {isSelectionMode && selectedIds.size > 0 && (
                <div className="mt-3 flex items-center gap-2 p-2 rounded-lg bg-primary/10 animate-in slide-in-from-top-2">
                  <Checkbox
                    checked={selectedIds.size === messages.length}
                    onCheckedChange={selectAll}
                  />
                  <span className="text-sm font-medium flex-1">
                    {selectedIds.size} selected
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={bulkArchive}>
                        <Archive className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Archive selected</TooltipContent>
                  </Tooltip>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={bulkDelete}>
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Delete selected</TooltipContent>
                  </Tooltip>
                  <Button variant="ghost" size="sm" onClick={() => { setSelectedIds(new Set()); setIsSelectionMode(false); }}>
                    Cancel
                  </Button>
                </div>
              )}
            </div>

            {/* Messages List */}
            <ScrollArea className="flex-1">
              {error && (
                <div className="p-8 text-center">
                  <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mx-auto mb-3">
                    <X className="w-6 h-6 text-destructive" />
                  </div>
                  <p className="text-sm text-muted-foreground mb-3">{error}</p>
                  <Button variant="outline" size="sm" onClick={() => window.location.href = "/connections"}>
                    Connect Email
                  </Button>
                </div>
              )}

              {!error && loading && (
                <div className="flex flex-col items-center justify-center py-16">
                  <Loader2 className="w-8 h-8 animate-spin text-primary mb-3" />
                  <p className="text-sm text-muted-foreground">Loading emails...</p>
                </div>
              )}

              {!error && !loading && messages.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 px-4">
                  <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-muted-foreground" />
                  </div>
                  <h3 className="font-medium mb-1">No messages</h3>
                  <p className="text-sm text-muted-foreground text-center">
                    Your inbox is empty. New emails will appear here.
                  </p>
                </div>
              )}

              {!error && !loading && messages.length > 0 && (
                <div className="divide-y">
                  {messages.map((msg) => {
                    const sender = msg.from[0];
                    const senderName = sender?.name || sender?.email?.split("@")[0] || "Unknown";
                    const senderEmail = sender?.email || "";
                    const isSelected = selectedIds.has(msg.id);
                    const isSwiping = swipingId === msg.id;

                    return (
                      <div
                        key={msg.id}
                        className="relative overflow-hidden"
                        onTouchStart={(e) => handleTouchStart(e, msg.id)}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                        {/* Swipe action background */}
                        <div className="absolute inset-y-0 right-0 w-24 bg-amber-500 flex items-center justify-center">
                          <Archive className="w-5 h-5 text-white" />
                        </div>

                        {/* Email row */}
                        <div
                          onClick={() => openMessage(msg)}
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setIsSelectionMode(true);
                            toggleSelect(msg.id);
                          }}
                          style={{
                            transform: isSwiping ? `translateX(${swipeOffset}px)` : "translateX(0)",
                            transition: isSwiping ? "none" : "transform 0.2s ease-out",
                          }}
                          className={cn(
                            "relative p-4 cursor-pointer transition-colors bg-background",
                            selectedMessage?.id === msg.id && "bg-primary/5 border-l-2 border-l-primary",
                            msg.unread && selectedMessage?.id !== msg.id && "bg-blue-50/50 dark:bg-blue-950/20",
                            isSelected && "bg-primary/10",
                            "hover:bg-muted/50 active:bg-muted"
                          )}
                        >
                          <div className="flex gap-3">
                            {/* Selection checkbox or Avatar */}
                            {isSelectionMode ? (
                              <div className="w-10 h-10 flex items-center justify-center">
                                <Checkbox
                                  checked={isSelected}
                                  onCheckedChange={() => toggleSelect(msg.id)}
                                  onClick={(e) => e.stopPropagation()}
                                />
                              </div>
                            ) : (
                              <div className={cn(
                                "w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 shadow-sm",
                                getAvatarColor(senderEmail)
                              )}>
                                {getInitials(senderName, senderEmail)}
                              </div>
                            )}

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <div className="flex items-center gap-2 min-w-0">
                                  <span className={cn(
                                    "text-sm truncate",
                                    msg.unread ? "font-semibold" : "font-medium"
                                  )}>
                                    {senderName}
                                  </span>
                                  {msg.unread && (
                                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0" />
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground whitespace-nowrap">
                                  {formatDate(msg.date)}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 mb-1">
                                <span className={cn(
                                  "text-sm truncate",
                                  msg.unread ? "font-medium text-foreground" : "text-muted-foreground"
                                )}>
                                  {msg.subject || "(no subject)"}
                                </span>
                                {msg.hasAttachments && (
                                  <Paperclip className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                                )}
                              </div>

                              <p className="text-xs text-muted-foreground truncate leading-relaxed">
                                {msg.snippet}
                              </p>
                            </div>

                            {/* Actions */}
                            <div className="flex flex-col items-center gap-1 flex-shrink-0">
                              <button
                                className="p-1 rounded-full hover:bg-muted transition-colors"
                                onClick={(e) => toggleStar(msg, e)}
                              >
                                <Star
                                  className={cn(
                                    "w-4 h-4 transition-colors",
                                    msg.starred
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/40 hover:text-muted-foreground"
                                  )}
                                />
                              </button>

                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    className="p-1 rounded-full hover:bg-muted transition-colors opacity-0 group-hover:opacity-100 md:opacity-100"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  <DropdownMenuItem onClick={() => archiveMessage(msg.id)}>
                                    <Archive className="w-4 h-4 mr-2" />
                                    Archive
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => markAsRead(msg.id, msg.unread)}>
                                    {msg.unread ? (
                                      <>
                                        <MailOpen className="w-4 h-4 mr-2" />
                                        Mark as read
                                      </>
                                    ) : (
                                      <>
                                        <Mail className="w-4 h-4 mr-2" />
                                        Mark as unread
                                      </>
                                    )}
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => deleteMessage(msg.id)}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>

            {/* Pagination */}
            {!error && messages.length > 0 && (
              <div className="p-3 border-t bg-background flex justify-between items-center">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={offset === 0}
                  onClick={() => fetchMessages(search, Math.max(0, offset - 50))}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Newer
                </Button>
                <span className="text-xs text-muted-foreground">
                  {offset + 1} - {offset + messages.length}
                </span>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={messages.length < 50}
                  onClick={() => fetchMessages(search, offset + 50)}
                >
                  Older
                  <ChevronLeft className="w-4 h-4 ml-1 rotate-180" />
                </Button>
              </div>
            )}
          </div>

          {/* Reading Pane - Only visible when message is selected */}
          {selectedMessage && (
          <div className={cn(
            "flex-1 flex flex-col bg-background",
            mobileView !== "detail" && "hidden md:flex"
          )}>
            {/* Mobile back button & actions */}
                <div className="flex items-center justify-between p-3 border-b md:hidden">
                  <Button variant="ghost" size="sm" onClick={() => setMobileView("list")}>
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={(e) => toggleStar(selectedMessage, e)}>
                      <Star className={cn("w-4 h-4", selectedMessage.starred && "fill-amber-400 text-amber-400")} />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => archiveMessage(selectedMessage.id)}>
                      <Archive className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => deleteMessage(selectedMessage.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {loadingMessage ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                  </div>
                ) : (
                  <>
                    {/* Email Header */}
                    <div className="p-6 border-b">
                      <div className="flex items-start justify-between gap-4 mb-4">
                        <h2 className="text-xl font-semibold leading-tight">
                          {selectedMessage.subject || "(no subject)"}
                        </h2>
                        <div className="hidden md:flex items-center gap-1 flex-shrink-0">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={(e) => toggleStar(selectedMessage, e)}>
                                <Star className={cn("w-4 h-4", selectedMessage.starred && "fill-amber-400 text-amber-400")} />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>{selectedMessage.starred ? "Unstar" : "Star"}</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => archiveMessage(selectedMessage.id)}>
                                <Archive className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Archive</TooltipContent>
                          </Tooltip>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => deleteMessage(selectedMessage.id)}>
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Delete</TooltipContent>
                          </Tooltip>
                        </div>
                      </div>

                      <div className="flex items-start gap-4">
                        <div className={cn(
                          "w-12 h-12 rounded-full flex items-center justify-center text-white font-medium flex-shrink-0 shadow-sm",
                          getAvatarColor(selectedMessage.from[0]?.email || "")
                        )}>
                          {getInitials(selectedMessage.from[0]?.name || "", selectedMessage.from[0]?.email || "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">
                              {selectedMessage.from[0]?.name || selectedMessage.from[0]?.email}
                            </span>
                            <span className="text-sm text-muted-foreground">
                              &lt;{selectedMessage.from[0]?.email}&gt;
                            </span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                            <span>to {selectedMessage.to.map(t => t.name || t.email).join(", ")}</span>
                            {selectedMessage.cc && selectedMessage.cc.length > 0 && (
                              <Badge variant="secondary" className="text-xs">
                                +{selectedMessage.cc.length} CC
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                            <Clock className="w-3.5 h-3.5" />
                            {formatFullDate(selectedMessage.date)}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Email Body */}
                    <ScrollArea className="flex-1">
                      <div className="p-6">
                        <div
                          className="prose prose-sm max-w-none dark:prose-invert prose-p:leading-relaxed prose-headings:font-semibold"
                          dangerouslySetInnerHTML={{
                            __html: DOMPurify.sanitize(selectedMessage.body || selectedMessage.snippet, PURIFY_CONFIG),
                          }}
                        />
                      </div>
                    </ScrollArea>

                    {/* Reply Bar */}
                    <div className="p-4 border-t bg-muted/30">
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          className="flex-1 justify-start h-12"
                          onClick={() => handleCompose(selectedMessage)}
                        >
                          <Reply className="w-4 h-4 mr-2" />
                          Reply
                        </Button>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="outline" size="icon" className="h-12 w-12">
                              <Forward className="w-4 h-4" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Forward</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </>
                )}
          </div>
          )}
        </div>

        {/* Mobile FAB */}
        <div className="fixed bottom-6 right-6 md:hidden">
          <Button
            size="lg"
            className="h-14 w-14 rounded-full shadow-lg"
            onClick={() => handleCompose()}
          >
            <Plus className="w-6 h-6" />
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
