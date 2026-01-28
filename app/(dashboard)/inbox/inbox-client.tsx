"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Loader2,
  Mail,
  MailOpen,
  Send,
  ArrowLeft,
  Search,
  RefreshCw,
  Star,
  Paperclip,
  X,
  Inbox,
  Plus,
} from "lucide-react";

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

type View = "list" | "detail" | "compose";

export function InboxClient() {
  const [view, setView] = useState<View>("list");
  const [loading, setLoading] = useState(true);
  const [messages, setMessages] = useState<EmailMessage[]>([]);
  const [selectedMessage, setSelectedMessage] = useState<EmailMessage | null>(null);
  const [loadingMessage, setLoadingMessage] = useState(false);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);

  // Compose state
  const [composeTo, setComposeTo] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeBody, setComposeBody] = useState("");
  const [sending, setSending] = useState(false);
  const [replyToId, setReplyToId] = useState<string | undefined>(undefined);

  const fetchMessages = useCallback(async (searchQuery?: string, newOffset = 0) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "25", offset: String(newOffset) });
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/dashboard/inbox?${params}`);
      const json = await res.json();

      if (!res.ok) {
        setError(json.error || "Failed to load inbox");
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
    setView("detail");
    try {
      const res = await fetch(`/api/dashboard/inbox/${msg.id}`);
      const json = await res.json();
      setSelectedMessage(json);

      // Mark as read in the list
      setMessages((prev) =>
        prev.map((m) => (m.id === msg.id ? { ...m, unread: false } : m))
      );
    } catch {
      setSelectedMessage(msg);
    } finally {
      setLoadingMessage(false);
    }
  };

  const handleCompose = () => {
    setComposeTo("");
    setComposeSubject("");
    setComposeBody("");
    setReplyToId(undefined);
    setView("compose");
  };

  const handleReply = (msg: EmailMessage) => {
    const fromAddr = msg.from[0];
    setComposeTo(fromAddr?.email || "");
    setComposeSubject(`Re: ${msg.subject}`);
    setComposeBody("");
    setReplyToId(msg.id);
    setView("compose");
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
        setView("list");
        fetchMessages();
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
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const formatFullDate = (unix: number) => {
    return new Date(unix * 1000).toLocaleString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  };

  // Compose View
  if (view === "compose") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
          <h2 className="text-lg font-semibold">
            {replyToId ? "Reply" : "New Email"}
          </h2>
        </div>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="email"
                placeholder="recipient@example.com"
                value={composeTo}
                onChange={(e) => setComposeTo(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Subject</Label>
              <Input
                id="subject"
                placeholder="Subject"
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Message</Label>
              <Textarea
                id="body"
                placeholder="Write your message..."
                value={composeBody}
                onChange={(e) => setComposeBody(e.target.value)}
                rows={12}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setView("list")}>
                Cancel
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
          </CardContent>
        </Card>
      </div>
    );
  }

  // Detail View
  if (view === "detail" && selectedMessage) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setView("list")}>
            <ArrowLeft className="w-4 h-4 mr-1" /> Back
          </Button>
        </div>

        <Card>
          {loadingMessage ? (
            <CardContent className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin" />
            </CardContent>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-lg">{selectedMessage.subject}</CardTitle>
                <div className="text-sm text-muted-foreground space-y-1">
                  <div>
                    <span className="font-medium text-foreground">From: </span>
                    {selectedMessage.from
                      .map((f) => (f.name ? `${f.name} <${f.email}>` : f.email))
                      .join(", ")}
                  </div>
                  <div>
                    <span className="font-medium text-foreground">To: </span>
                    {selectedMessage.to
                      .map((t) => (t.name ? `${t.name} <${t.email}>` : t.email))
                      .join(", ")}
                  </div>
                  {selectedMessage.cc && selectedMessage.cc.length > 0 && (
                    <div>
                      <span className="font-medium text-foreground">CC: </span>
                      {selectedMessage.cc.map((c) => c.email).join(", ")}
                    </div>
                  )}
                  <div>{formatFullDate(selectedMessage.date)}</div>
                </div>
              </CardHeader>
              <CardContent>
                <div
                  className="prose prose-sm max-w-none dark:prose-invert"
                  dangerouslySetInnerHTML={{ __html: selectedMessage.body }}
                />
                <div className="mt-6 pt-4 border-t flex gap-2">
                  <Button size="sm" onClick={() => handleReply(selectedMessage)}>
                    <Mail className="w-4 h-4 mr-1" /> Reply
                  </Button>
                </div>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    );
  }

  // List View
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inbox</h1>
          <p className="text-muted-foreground text-sm">
            Read and send emails from your connected account.
          </p>
        </div>
        <Button onClick={handleCompose}>
          <Plus className="w-4 h-4 mr-2" /> Compose
        </Button>
      </div>

      {/* Search & Refresh */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search emails..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => fetchMessages(search, 0)}
          disabled={loading}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {error && (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">{error}</p>
            <Button variant="link" className="mt-2" onClick={() => window.location.href = "/connections"}>
              Go to Connections
            </Button>
          </CardContent>
        </Card>
      )}

      {!error && loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      )}

      {!error && !loading && messages.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">No messages found.</p>
          </CardContent>
        </Card>
      )}

      {!error && !loading && messages.length > 0 && (
        <Card>
          <CardContent className="p-0 divide-y">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors ${
                  msg.unread ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                }`}
                onClick={() => openMessage(msg)}
              >
                <button
                  className="shrink-0"
                  onClick={(e) => toggleStar(msg, e)}
                >
                  <Star
                    className={`w-4 h-4 ${
                      msg.starred
                        ? "fill-yellow-400 text-yellow-400"
                        : "text-muted-foreground"
                    }`}
                  />
                </button>
                <div className="shrink-0">
                  {msg.unread ? (
                    <Mail className="w-4 h-4 text-blue-500" />
                  ) : (
                    <MailOpen className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-sm truncate ${
                        msg.unread ? "font-semibold" : ""
                      }`}
                    >
                      {msg.from[0]?.name || msg.from[0]?.email || "Unknown"}
                    </span>
                    {msg.hasAttachments && (
                      <Paperclip className="w-3 h-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                  <div
                    className={`text-sm truncate ${
                      msg.unread ? "font-medium text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {msg.subject}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {msg.snippet}
                  </div>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                  {formatDate(msg.date)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Pagination */}
      {!error && messages.length > 0 && (
        <div className="flex justify-between">
          <Button
            variant="outline"
            size="sm"
            disabled={offset === 0}
            onClick={() => fetchMessages(search, Math.max(0, offset - 25))}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={messages.length < 25}
            onClick={() => fetchMessages(search, offset + 25)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
