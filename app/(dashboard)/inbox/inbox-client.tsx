"use client";

import { useState, useEffect, useCallback } from "react";
import DOMPurify from "dompurify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
} from "lucide-react";
import { toast } from "@/hooks/use-toast";

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
    "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-pink-500",
    "bg-indigo-500", "bg-teal-500", "bg-orange-500", "bg-cyan-500",
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
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
    // Reset AI state
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

      // Populate the subject and body fields
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
        fetchMessages(search, 0);
      }
    } finally {
      setSending(false);
    }
  };

  const toggleStar = async (msg: EmailMessage, e: React.MouseEvent) => {
    e.stopPropagation();
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

  const formatDate = (unix: number) => {
    const d = new Date(unix * 1000);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    }
    if (d.getFullYear() === now.getFullYear()) {
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    }
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  const formatFullDate = (unix: number) => {
    return new Date(unix * 1000).toLocaleString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col">
      {/* Compose Modal */}
      {showCompose && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="font-semibold">{replyToId ? "Reply" : "New Message"}</h2>
              <Button variant="ghost" size="icon" onClick={() => setShowCompose(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-auto p-4 space-y-4">
              {/* AI Generation Panel */}
              {!replyToId && (
                <div className="border rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    className="w-full flex items-center justify-between p-3 bg-gradient-to-r from-purple-500/10 to-blue-500/10 hover:from-purple-500/20 hover:to-blue-500/20 transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-purple-500" />
                      <span className="font-medium text-sm">Generate with AI</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showAiPanel ? "rotate-180" : ""}`} />
                  </button>

                  {showAiPanel && (
                    <div className="p-3 border-t space-y-3 bg-muted/30">
                      <div>
                        <Label className="text-xs text-muted-foreground">
                          Describe what you want to say
                        </Label>
                        <Textarea
                          placeholder="e.g., Thank the customer for their business and let them know about our new services..."
                          value={aiPrompt}
                          onChange={(e) => setAiPrompt(e.target.value)}
                          rows={3}
                          className="mt-1"
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-xs text-muted-foreground">Tone</Label>
                          <Select
                            value={aiTone}
                            onValueChange={(v) => setAiTone(v as typeof aiTone)}
                          >
                            <SelectTrigger className="mt-1">
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
                          <Label className="text-xs text-muted-foreground">Purpose</Label>
                          <Select
                            value={aiPurpose}
                            onValueChange={(v) => setAiPurpose(v as typeof aiPurpose)}
                          >
                            <SelectTrigger className="mt-1">
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
                        className="w-full"
                        size="sm"
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

              <div>
                <Label htmlFor="to" className="text-xs text-muted-foreground">To</Label>
                <Input
                  id="to"
                  type="email"
                  placeholder="recipient@example.com"
                  value={composeTo}
                  onChange={(e) => setComposeTo(e.target.value)}
                  className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
                />
              </div>
              <div>
                <Label htmlFor="subject" className="text-xs text-muted-foreground">Subject</Label>
                <Input
                  id="subject"
                  placeholder="Subject"
                  value={composeSubject}
                  onChange={(e) => setComposeSubject(e.target.value)}
                  className="border-0 border-b rounded-none px-0 focus-visible:ring-0"
                />
              </div>
              <Textarea
                placeholder="Write your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                className="min-h-[200px] border-0 resize-none focus-visible:ring-0"
              />
            </div>
            <div className="flex justify-between items-center p-4 border-t">
              <Button variant="ghost" onClick={() => setShowCompose(false)}>
                Discard
              </Button>
              <Button
                onClick={handleSend}
                disabled={!composeTo || !composeSubject || sending}
              >
                {sending ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Send
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Main Layout */}
      <div className="flex-1 flex overflow-hidden rounded-lg border bg-background">
        {/* Message List */}
        <div className={`w-80 border-r flex-shrink-0 flex flex-col ${
          mobileView !== "list" ? "hidden md:flex" : "flex flex-1 md:flex-none"
        }`}>
          {/* Search Bar */}
          <div className="p-3 border-b space-y-2">
            <div className="flex gap-2">
              <Button className="flex-1" onClick={() => handleCompose()}>
                <Plus className="w-4 h-4 mr-2" />
                New Email
              </Button>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                  className="pl-9 h-9"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => fetchMessages(search, 0)}
                disabled={loading}
              >
                <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1">
            {error && (
              <div className="p-4 text-center">
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="link" size="sm" onClick={() => window.location.href = "/connections"}>
                  Go to Connections
                </Button>
              </div>
            )}

            {!error && loading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            )}

            {!error && !loading && messages.length === 0 && (
              <div className="p-8 text-center">
                <Inbox className="w-10 h-10 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No messages</p>
              </div>
            )}

            {!error && !loading && messages.length > 0 && (
              <div className="divide-y">
                {messages.map((msg) => {
                  const sender = msg.from[0];
                  const senderName = sender?.name || sender?.email || "Unknown";
                  const senderEmail = sender?.email || "";

                  return (
                    <div
                      key={msg.id}
                      onClick={() => openMessage(msg)}
                      className={`p-3 cursor-pointer transition-colors ${
                        selectedMessage?.id === msg.id
                          ? "bg-primary/10 border-l-2 border-l-primary"
                          : msg.unread
                          ? "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="flex gap-3">
                        {/* Avatar */}
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${getAvatarColor(senderEmail)}`}>
                          {getInitials(senderName, senderEmail)}
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`text-sm truncate ${msg.unread ? "font-semibold" : ""}`}>
                              {senderName}
                            </span>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {formatDate(msg.date)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className={`text-sm truncate ${msg.unread ? "font-medium" : "text-muted-foreground"}`}>
                              {msg.subject || "(no subject)"}
                            </span>
                            {msg.hasAttachments && (
                              <Paperclip className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">
                            {msg.snippet}
                          </p>
                        </div>

                        {/* Star */}
                        <button
                          className="flex-shrink-0 self-start mt-1"
                          onClick={(e) => toggleStar(msg, e)}
                        >
                          <Star
                            className={`w-4 h-4 ${
                              msg.starred
                                ? "fill-yellow-400 text-yellow-400"
                                : "text-muted-foreground/50 hover:text-muted-foreground"
                            }`}
                          />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </ScrollArea>

          {/* Pagination */}
          {!error && messages.length > 0 && (
            <div className="p-2 border-t flex justify-between">
              <Button
                variant="ghost"
                size="sm"
                disabled={offset === 0}
                onClick={() => fetchMessages(search, Math.max(0, offset - 50))}
              >
                Newer
              </Button>
              <Button
                variant="ghost"
                size="sm"
                disabled={messages.length < 50}
                onClick={() => fetchMessages(search, offset + 50)}
              >
                Older
              </Button>
            </div>
          )}
        </div>

        {/* Reading Pane */}
        <div className={`flex-1 flex flex-col ${
          mobileView !== "detail" ? "hidden md:flex" : "flex"
        }`}>
          {selectedMessage ? (
            <>
              {/* Mobile back button */}
              <div className="md:hidden p-2 border-b">
                <Button variant="ghost" size="sm" onClick={() => setMobileView("list")}>
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </div>

              {loadingMessage ? (
                <div className="flex-1 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <>
                  {/* Email Header */}
                  <div className="p-4 border-b">
                    <h2 className="text-lg font-semibold mb-3">{selectedMessage.subject || "(no subject)"}</h2>
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-medium flex-shrink-0 ${getAvatarColor(selectedMessage.from[0]?.email || "")}`}>
                        {getInitials(selectedMessage.from[0]?.name || "", selectedMessage.from[0]?.email || "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">
                            {selectedMessage.from[0]?.name || selectedMessage.from[0]?.email}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            &lt;{selectedMessage.from[0]?.email}&gt;
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          To: {selectedMessage.to.map(t => t.name || t.email).join(", ")}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          {formatFullDate(selectedMessage.date)}
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={(e) => toggleStar(selectedMessage, e)}
                        >
                          <Star className={`w-4 h-4 ${selectedMessage.starred ? "fill-yellow-400 text-yellow-400" : ""}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleCompose(selectedMessage)}
                        >
                          <Reply className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Email Body */}
                  <ScrollArea className="flex-1 p-4">
                    <div
                      className="prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{
                        __html: DOMPurify.sanitize(selectedMessage.body || selectedMessage.snippet, PURIFY_CONFIG),
                      }}
                    />
                  </ScrollArea>

                  {/* Quick Reply */}
                  <div className="p-4 border-t">
                    <Button variant="outline" className="w-full justify-start text-muted-foreground" onClick={() => handleCompose(selectedMessage)}>
                      <Reply className="w-4 h-4 mr-2" />
                      Reply to this message...
                    </Button>
                  </div>
                </>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
              <Mail className="w-16 h-16 mb-4 opacity-20" />
              <p>Select a message to read</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
