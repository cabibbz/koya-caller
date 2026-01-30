"use client";

/**
 * Mass Email Composer Component
 * Allows sending emails to multiple contacts at once
 * With AI-powered email generation
 */

import { useState, useEffect } from "react";
import {
  Loader2,
  X,
  Send,
  Users,
  Search,
  Check,
  Mail,
  AlertCircle,
  Sparkles,
  ChevronDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";

interface Contact {
  id: string;
  name: string;
  email: string;
  phone_number?: string;
}

interface MassEmailComposerProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function MassEmailComposer({ isOpen, onClose, onSuccess }: MassEmailComposerProps) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sendResult, setSendResult] = useState<{
    sent: number;
    failed: number;
    total: number;
  } | null>(null);

  // AI Generation state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiTone, setAiTone] = useState<"professional" | "friendly" | "casual" | "urgent">("professional");
  const [aiPurpose, setAiPurpose] = useState<"marketing" | "follow_up" | "reminder" | "announcement" | "thank_you" | "general">("general");
  const [generatingAi, setGeneratingAi] = useState(false);

  // Fetch contacts
  useEffect(() => {
    if (isOpen) {
      fetchContacts();
    }
  }, [isOpen]);

  const fetchContacts = async () => {
    setLoadingContacts(true);
    try {
      const response = await fetch("/api/dashboard/contacts?limit=500");
      const result = await response.json();
      if (result.success) {
        // Only include contacts with email addresses
        const contactsWithEmail = (result.data?.contacts || []).filter(
          (c: Contact) => c.email && c.email.trim().length > 0
        );
        setContacts(contactsWithEmail);
      }
    } catch {
      toast({
        title: "Error",
        description: "Failed to load contacts",
        variant: "destructive",
      });
    } finally {
      setLoadingContacts(false);
    }
  };

  const toggleContact = (contactId: string) => {
    const newSelected = new Set(selectedContacts);
    if (newSelected.has(contactId)) {
      newSelected.delete(contactId);
    } else {
      newSelected.add(contactId);
    }
    setSelectedContacts(newSelected);
  };

  const selectAll = () => {
    const filtered = filteredContacts.map((c) => c.id);
    setSelectedContacts(new Set([...selectedContacts, ...filtered]));
  };

  const deselectAll = () => {
    const filtered = new Set(filteredContacts.map((c) => c.id));
    const newSelected = new Set(
      [...selectedContacts].filter((id) => !filtered.has(id))
    );
    setSelectedContacts(newSelected);
  };

  const filteredContacts = contacts.filter((contact) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      contact.name?.toLowerCase().includes(query) ||
      contact.email?.toLowerCase().includes(query) ||
      contact.phone_number?.includes(query)
    );
  });

  const handleSend = async () => {
    if (selectedContacts.size === 0) {
      toast({
        title: "No recipients",
        description: "Please select at least one contact",
        variant: "destructive",
      });
      return;
    }

    if (!subject.trim()) {
      toast({
        title: "Subject required",
        description: "Please enter a subject",
        variant: "destructive",
      });
      return;
    }

    setSending(true);
    setSendResult(null);

    try {
      const recipients = contacts
        .filter((c) => selectedContacts.has(c.id))
        .map((c) => ({ email: c.email, name: c.name }));

      const response = await fetch("/api/dashboard/inbox/mass-send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipients,
          subject,
          body,
          htmlBody: body.replace(/\n/g, "<br>"),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to send emails");
      }

      setSendResult({
        sent: result.sent,
        failed: result.failed,
        total: result.total,
      });

      if (result.sent > 0) {
        toast({
          title: "Emails sent",
          description: `Successfully sent ${result.sent} of ${result.total} emails`,
          variant: result.failed > 0 ? "warning" : "success",
        });

        if (result.failed === 0) {
          // Reset and close on complete success
          setTimeout(() => {
            resetForm();
            onSuccess?.();
            onClose();
          }, 1500);
        }
      } else {
        toast({
          title: "Failed to send",
          description: "No emails were sent successfully",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send emails",
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
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
      setSubject(result.subject);
      setBody(result.body);
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

  const resetForm = () => {
    setSelectedContacts(new Set());
    setSubject("");
    setBody("");
    setSearchQuery("");
    setSendResult(null);
    setShowAiPanel(false);
    setAiPrompt("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  if (!isOpen) return null;

  const selectedCount = selectedContacts.size;
  const selectedWithEmail = contacts.filter(
    (c) => selectedContacts.has(c.id) && c.email
  ).length;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold">Send Mass Email</h2>
          </div>
          <Button variant="ghost" size="icon" onClick={handleClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden flex">
          {/* Contact Selection - Left Panel */}
          <div className="w-80 border-r flex flex-col">
            <div className="p-3 border-b space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">
                  Select Recipients ({selectedCount})
                </span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="sm" onClick={selectAll}>
                    All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={deselectAll}>
                    None
                  </Button>
                </div>
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8 h-8"
                />
              </div>
            </div>

            <ScrollArea className="flex-1">
              {loadingContacts ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                </div>
              ) : filteredContacts.length === 0 ? (
                <div className="p-4 text-center">
                  <Mail className="w-8 h-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {contacts.length === 0
                      ? "No contacts with email addresses"
                      : "No matching contacts"}
                  </p>
                </div>
              ) : (
                <div className="divide-y">
                  {filteredContacts.map((contact) => (
                    <label
                      key={contact.id}
                      className="flex items-center gap-3 p-3 hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedContacts.has(contact.id)}
                        onCheckedChange={() => toggleContact(contact.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {contact.name || "Unknown"}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {contact.email}
                        </p>
                      </div>
                      {selectedContacts.has(contact.id) && (
                        <Check className="w-4 h-4 text-primary flex-shrink-0" />
                      )}
                    </label>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>

          {/* Email Composition - Right Panel */}
          <div className="flex-1 flex flex-col p-4">
            {sendResult ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${
                  sendResult.failed === 0 ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"
                }`}>
                  {sendResult.failed === 0 ? (
                    <Check className="w-8 h-8" />
                  ) : (
                    <AlertCircle className="w-8 h-8" />
                  )}
                </div>
                <h3 className="text-lg font-semibold mb-2">
                  {sendResult.failed === 0 ? "All Emails Sent!" : "Partially Sent"}
                </h3>
                <p className="text-muted-foreground text-center">
                  Successfully sent {sendResult.sent} of {sendResult.total} emails
                </p>
                {sendResult.failed > 0 && (
                  <p className="text-sm text-orange-600 mt-2">
                    {sendResult.failed} email(s) failed to send
                  </p>
                )}
              </div>
            ) : (
              <>
                <div className="space-y-4 flex-1">
                  {/* AI Generation Panel */}
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
                            placeholder="e.g., Thank customers for their recent purchase and invite them to leave a review..."
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

                  <div>
                    <Label htmlFor="mass-subject" className="text-xs text-muted-foreground">
                      Subject *
                    </Label>
                    <Input
                      id="mass-subject"
                      placeholder="Email subject..."
                      value={subject}
                      onChange={(e) => setSubject(e.target.value)}
                      className="mt-1"
                    />
                  </div>

                  <div className="flex-1 flex flex-col">
                    <Label htmlFor="mass-body" className="text-xs text-muted-foreground mb-1">
                      Message
                    </Label>
                    <Textarea
                      id="mass-body"
                      placeholder="Write your message here..."
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      className="flex-1 min-h-[200px] resize-none"
                    />
                  </div>

                  {selectedCount > 0 && (
                    <Alert>
                      <Mail className="w-4 h-4" />
                      <AlertDescription>
                        This email will be sent to <strong>{selectedWithEmail}</strong> contact
                        {selectedWithEmail !== 1 ? "s" : ""} individually. Each recipient will only
                        see their own email address.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center p-4 border-t">
          <Button variant="ghost" onClick={handleClose}>
            {sendResult ? "Close" : "Cancel"}
          </Button>
          {!sendResult && (
            <Button
              onClick={handleSend}
              disabled={selectedCount === 0 || !subject.trim() || sending}
            >
              {sending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send to {selectedCount} Contact{selectedCount !== 1 ? "s" : ""}
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
