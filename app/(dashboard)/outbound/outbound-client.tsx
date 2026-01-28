"use client";

/**
 * Outbound Command Center Client Component
 * Unified interface for campaigns, contacts, call history, and settings
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Phone,
  PhoneOutgoing,
  Users,
  History,
  Settings,
  Plus,
  Loader2,
  TrendingUp,
  CheckCircle2,
  Calendar,
  Play,
  Pause,
  Zap,
  MoreVertical,
  Trash2,
  StopCircle,
  Search,
  UserPlus,
  Download,
  Star,
  Mail,
  Clock,
  X,
  Save,
  Bell,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Filter,
  PlayCircle,
  Upload,
  FileText,
} from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Progress,
  Input,
  Label,
  Switch,
  Checkbox,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  Alert,
  AlertDescription,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Textarea,
} from "@/components/ui";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow, format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";

// =============================================================================
// Types
// =============================================================================

interface Campaign {
  id: string;
  name: string;
  description: string | null;
  status: "draft" | "scheduled" | "active" | "running" | "paused" | "completed";
  type: "reminder" | "followup" | "custom" | "appointment_reminder" | "follow_up" | "marketing";
  scheduled_start: string | null;
  scheduled_end: string | null;
  scheduled_at: string | null;
  target_contacts: number;
  calls_completed: number;
  calls_successful: number;
  calls_failed: number;
  created_at: string;
  updated_at: string;
}

interface OutboundCall {
  id: string;
  from_number: string | null;
  to_number: string | null;
  direction: "inbound" | "outbound" | null;
  duration_seconds: number | null;
  outcome: string | null;
  recording_url: string | null;
  transcript: Record<string, unknown> | null;
  summary: string | null;
  started_at: string | null;
  created_at: string;
  // Joined from caller_profiles if available
  caller_name?: string | null;
}

interface Contact {
  id: string;
  name: string | null;
  phone_number: string;
  email: string | null;
  vip_status: boolean;
  total_calls: number;
  last_call_at: string | null;
  created_at: string;
}

interface OutboundStats {
  callsToday: number;
  answeredRate: number;
  appointmentsBooked: number;
  activeCampaigns: number;
}

interface OutboundSettings {
  reminder_calls_enabled: boolean;
  reminder_24hr_enabled: boolean;
  reminder_2hr_enabled: boolean;
  reminder_agent_id: string | null;
  reminder_from_number: string | null;
  daily_call_limit: number;
  outbound_hours_start: string;
  outbound_hours_end: string;
  timezone: string;
}

interface Agent {
  id: string;
  name: string;
}

// =============================================================================
// Helper Functions
// =============================================================================

const getStatusColor = (status: Campaign["status"]) => {
  const colors = {
    draft: "bg-gray-500/10 text-gray-600 border-gray-200",
    scheduled: "bg-blue-500/10 text-blue-600 border-blue-200",
    active: "bg-green-500/10 text-green-600 border-green-200",
    running: "bg-green-500/10 text-green-600 border-green-200",
    paused: "bg-yellow-500/10 text-yellow-600 border-yellow-200",
    completed: "bg-purple-500/10 text-purple-600 border-purple-200",
  };
  return colors[status] || colors.draft;
};

const formatPhoneNumber = (phone: string | null): string => {
  if (!phone) return "Unknown";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("1")) {
    const match = cleaned.slice(1).match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  if (cleaned.length === 10) {
    const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
    if (match) return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  return phone;
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
};

const formatTime = (time: string) => {
  const [hours, minutes] = time.split(":");
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

const generateTimeOptions = () => {
  const options: string[] = [];
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const h = hour.toString().padStart(2, "0");
      const m = minute.toString().padStart(2, "0");
      options.push(`${h}:${m}`);
    }
  }
  return options;
};

const TIME_OPTIONS = generateTimeOptions();

const TIMEZONES = [
  { value: "America/New_York", label: "Eastern (ET)" },
  { value: "America/Chicago", label: "Central (CT)" },
  { value: "America/Denver", label: "Mountain (MT)" },
  { value: "America/Los_Angeles", label: "Pacific (PT)" },
  { value: "America/Phoenix", label: "Arizona (MST)" },
];

const DEFAULT_SETTINGS: OutboundSettings = {
  reminder_calls_enabled: false,
  reminder_24hr_enabled: true,
  reminder_2hr_enabled: true,
  reminder_agent_id: null,
  reminder_from_number: null,
  daily_call_limit: 100,
  outbound_hours_start: "09:00",
  outbound_hours_end: "18:00",
  timezone: "America/Los_Angeles",
};

// =============================================================================
// Main Component
// =============================================================================

export function OutboundClient() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("campaigns");
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Stats state
  const [stats, setStats] = useState<OutboundStats>({
    callsToday: 0,
    answeredRate: 0,
    appointmentsBooked: 0,
    activeCampaigns: 0,
  });
  const [statsLoading, setStatsLoading] = useState(true);

  // Campaigns state
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(true);
  const [campaignActionLoading, setCampaignActionLoading] = useState<string | null>(null);

  // Call log state
  const [calls, setCalls] = useState<OutboundCall[]>([]);
  const [callsLoading, setCallsLoading] = useState(false);
  const [callsPage, setCallsPage] = useState(1);
  const [callsTotal, setCallsTotal] = useState(0);

  // Contacts state
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsTotal, setContactsTotal] = useState(0);
  const [contactSearch, setContactSearch] = useState("");
  const [selectedContacts, setSelectedContacts] = useState<Set<string>>(new Set());

  // Create contact dialog
  const [createContactOpen, setCreateContactOpen] = useState(false);
  const [newContact, setNewContact] = useState({ name: "", phone: "", email: "", notes: "" });
  const [creatingContact, setCreatingContact] = useState(false);

  // Import contacts
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importingContacts, setImportingContacts] = useState(false);

  // Delete contacts
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingContacts, setDeletingContacts] = useState(false);

  // Settings state
  const [settings, setSettings] = useState<OutboundSettings>(DEFAULT_SETTINGS);
  const [originalSettings, setOriginalSettings] = useState<OutboundSettings>(DEFAULT_SETTINGS);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);

  // =============================================================================
  // Data Fetching
  // =============================================================================

  const fetchStats = useCallback(async () => {
    try {
      // Fetch campaigns to calculate stats
      const res = await fetch("/api/dashboard/campaigns");
      if (res.ok) {
        const data = await res.json();
        const campaignList = data.data?.campaigns || [];

        const activeCampaigns = campaignList.filter(
          (c: Campaign) => c.status === "active" || c.status === "running"
        ).length;

        const totalCalls = campaignList.reduce(
          (acc: number, c: Campaign) => acc + (c.calls_completed || 0), 0
        );
        const successfulCalls = campaignList.reduce(
          (acc: number, c: Campaign) => acc + (c.calls_successful || 0), 0
        );

        setStats({
          callsToday: totalCalls,
          answeredRate: totalCalls > 0 ? Math.round((successfulCalls / totalCalls) * 100) : 0,
          appointmentsBooked: successfulCalls,
          activeCampaigns,
        });
      }
    } catch (error) {
      console.error("Failed to fetch stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const res = await fetch("/api/dashboard/campaigns");
      if (res.ok) {
        const data = await res.json();
        setCampaigns(data.data?.campaigns || []);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch campaigns", variant: "destructive" });
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  const fetchCalls = useCallback(async () => {
    setCallsLoading(true);
    try {
      const offset = (callsPage - 1) * 20;
      const res = await fetch(`/api/dashboard/calls?limit=20&offset=${offset}`);
      if (res.ok) {
        const data = await res.json();
        // Filter to show outbound calls only (or all if direction is not set)
        const allCalls = data.data?.calls || [];
        const outboundCalls = allCalls.filter(
          (c: OutboundCall) => c.direction === "outbound" || c.direction === null
        );
        setCalls(outboundCalls);
        setCallsTotal(data.data?.total || 0);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch calls", variant: "destructive" });
    } finally {
      setCallsLoading(false);
    }
  }, [callsPage]);

  const fetchContacts = useCallback(async () => {
    setContactsLoading(true);
    try {
      const params = new URLSearchParams({ page: contactsPage.toString(), limit: "20" });
      if (contactSearch) params.set("search", contactSearch);

      const res = await fetch(`/api/dashboard/contacts?${params}`);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.data?.contacts || []);
        setContactsTotal(data.data?.total || 0);
      }
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch contacts", variant: "destructive" });
    } finally {
      setContactsLoading(false);
    }
  }, [contactsPage, contactSearch]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const [settingsRes, agentsRes] = await Promise.all([
        fetch("/api/dashboard/settings/outbound"),
        fetch("/api/dashboard/agents"),
      ]);

      if (settingsRes.ok) {
        const data = await settingsRes.json();
        const merged = { ...DEFAULT_SETTINGS, ...data.data };
        setSettings(merged);
        setOriginalSettings(merged);
      }

      if (agentsRes.ok) {
        const data = await agentsRes.json();
        setAgents(data.data || []);
      }
    } catch (error) {
      console.error("Failed to fetch settings:", error);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchStats();
    fetchCampaigns();
  }, [fetchStats, fetchCampaigns]);

  // Tab-specific loading
  useEffect(() => {
    if (activeTab === "calls" && calls.length === 0) {
      fetchCalls();
    } else if (activeTab === "contacts" && contacts.length === 0) {
      fetchContacts();
    }
  }, [activeTab, calls.length, contacts.length, fetchCalls, fetchContacts]);

  // Settings panel
  useEffect(() => {
    if (settingsOpen && !settingsLoading && agents.length === 0) {
      fetchSettings();
    }
  }, [settingsOpen, settingsLoading, agents.length, fetchSettings]);

  // =============================================================================
  // Campaign Actions
  // =============================================================================

  const handleCampaignAction = async (campaignId: string, action: string) => {
    setCampaignActionLoading(campaignId);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || `Failed to ${action} campaign`);
      }

      toast({ title: "Success", description: `Campaign ${action}ed`, variant: "success" });
      fetchCampaigns();
      fetchStats();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : `Failed to ${action} campaign`,
        variant: "destructive",
      });
    } finally {
      setCampaignActionLoading(null);
    }
  };

  const handleProcessCalls = async (campaignId: string) => {
    setCampaignActionLoading(`process-${campaignId}`);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}/process`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error?.message || data.error || "Failed to process calls");
      }

      if (data.data?.processed === 0) {
        toast({ title: "No Pending Calls", description: "No calls to process in this campaign" });
      } else {
        toast({
          title: "Calls Processed",
          description: `${data.data?.processed || 0} calls processed`,
          variant: "success",
        });
      }

      fetchCampaigns();
      fetchStats();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to process calls",
        variant: "destructive",
      });
    } finally {
      setCampaignActionLoading(null);
    }
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm("Delete this campaign? This cannot be undone.")) return;

    setCampaignActionLoading(campaignId);
    try {
      const res = await fetch(`/api/dashboard/campaigns/${campaignId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete campaign");

      toast({ title: "Deleted", description: "Campaign deleted", variant: "success" });
      fetchCampaigns();
      fetchStats();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete campaign", variant: "destructive" });
    } finally {
      setCampaignActionLoading(null);
    }
  };

  // =============================================================================
  // Contact Actions
  // =============================================================================

  const handleCreateContact = async () => {
    if (!newContact.phone.trim()) {
      toast({ title: "Phone required", variant: "destructive" });
      return;
    }

    setCreatingContact(true);
    try {
      const res = await fetch("/api/dashboard/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newContact.name.trim() || null,
          phone_number: newContact.phone.trim(),
          email: newContact.email.trim() || null,
          notes: newContact.notes.trim() || null,
        }),
      });

      if (!res.ok) throw new Error("Failed to create contact");

      setCreateContactOpen(false);
      setNewContact({ name: "", phone: "", email: "", notes: "" });
      toast({ title: "Contact created", variant: "success" });
      fetchContacts();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create contact", variant: "destructive" });
    } finally {
      setCreatingContact(false);
    }
  };

  // Handle file upload - loads content into text box
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      setImportText(text);
      toast({ title: "File loaded", description: "Review the contacts and click Import to add them" });
    } catch {
      toast({ title: "Error", description: "Could not read the file", variant: "destructive" });
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Handle drag and drop
  const handleDrop = async (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const file = event.dataTransfer.files?.[0];
    if (!file) return;

    if (!file.name.match(/\.(txt|csv|tsv)$/i)) {
      toast({ title: "Invalid file", description: "Please upload a .txt, .csv, or .tsv file", variant: "destructive" });
      return;
    }

    try {
      const text = await file.text();
      setImportText(text);
      toast({ title: "File loaded", description: "Review the contacts and click Import to add them" });
    } catch {
      toast({ title: "Error", description: "Could not read the file", variant: "destructive" });
    }
  };

  // Process the text box content and create contacts
  const processImportText = async () => {
    if (!importText.trim()) {
      toast({ title: "No data", description: "Enter contacts or upload a file first", variant: "destructive" });
      return;
    }

    setImportingContacts(true);

    try {
      const lines = importText.split(/\r?\n/).filter(line => line.trim());

      // Parse contacts from text
      const contacts: Array<{ name?: string; phone: string; email?: string }> = [];

      // Phone regex - matches various formats
      const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
      // Email regex
      const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;

      // Check if first line looks like a header
      const firstLine = lines[0]?.toLowerCase() || "";
      const hasHeader = firstLine.includes("name") || firstLine.includes("phone") || firstLine.includes("email");
      const startIndex = hasHeader ? 1 : 0;

      for (let i = startIndex; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // Try CSV parsing first
        const parts = line.split(/[,\t]/).map(p => p.trim().replace(/^["']|["']$/g, ""));

        // Extract phone numbers from the line
        const phones = line.match(phoneRegex);
        const emails = line.match(emailRegex);

        if (phones && phones.length > 0) {
          // Clean the phone number
          let phone = phones[0].replace(/\D/g, "");
          if (phone.length === 10) phone = "1" + phone;
          if (phone.length === 11 && phone.startsWith("1")) {
            phone = "+" + phone;
          }

          // Try to extract name (anything that's not a phone or email)
          let name: string | undefined;
          if (parts.length >= 2) {
            // If CSV format, first column is likely name
            const potentialName = parts[0];
            if (!potentialName.match(phoneRegex) && !potentialName.match(emailRegex)) {
              name = potentialName;
            }
          }

          contacts.push({
            name: name || undefined,
            phone,
            email: emails?.[0] || undefined,
          });
        }
      }

      if (contacts.length === 0) {
        toast({ title: "No contacts found", description: "Could not parse any valid phone numbers", variant: "destructive" });
        return;
      }

      // Create contacts via API
      let created = 0;
      let failed = 0;

      for (const contact of contacts) {
        try {
          const res = await fetch("/api/dashboard/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              name: contact.name || null,
              phone_number: contact.phone,
              email: contact.email || null,
            }),
          });

          if (res.ok) {
            created++;
          } else {
            failed++;
          }
        } catch {
          failed++;
        }
      }

      toast({
        title: "Import complete",
        description: `Created ${created} contacts${failed > 0 ? `, ${failed} failed (duplicates or invalid)` : ""}`,
        variant: created > 0 ? "success" : "destructive",
      });

      if (created > 0) {
        fetchContacts();
        setImportDialogOpen(false);
        setImportText("");
      }
    } catch {
      toast({ title: "Import failed", description: "Could not process the contacts", variant: "destructive" });
    } finally {
      setImportingContacts(false);
    }
  };

  const handleContactSelect = (contactId: string) => {
    setSelectedContacts(prev => {
      const next = new Set(prev);
      if (next.has(contactId)) {
        next.delete(contactId);
      } else {
        next.add(contactId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedContacts.size === contacts.length) {
      setSelectedContacts(new Set());
    } else {
      setSelectedContacts(new Set(contacts.map(c => c.id)));
    }
  };

  const handleDeleteSelectedContacts = async () => {
    setDeletingContacts(true);
    let deleted = 0;
    let failed = 0;

    for (const contactId of selectedContacts) {
      try {
        const res = await fetch(`/api/dashboard/contacts/${contactId}`, {
          method: "DELETE",
        });
        if (res.ok) {
          deleted++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
    }

    toast({
      title: "Contacts deleted",
      description: `Deleted ${deleted} contacts${failed > 0 ? `, ${failed} failed` : ""}`,
      variant: deleted > 0 ? "success" : "destructive",
    });

    setSelectedContacts(new Set());
    setDeleteDialogOpen(false);
    setDeletingContacts(false);
    fetchContacts();
  };

  // =============================================================================
  // Settings Actions
  // =============================================================================

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const res = await fetch("/api/dashboard/settings/outbound", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });

      if (!res.ok) throw new Error("Failed to save settings");

      setOriginalSettings(settings);
      toast({ title: "Settings saved", variant: "success" });
    } catch (error) {
      toast({ title: "Error", description: "Failed to save settings", variant: "destructive" });
    } finally {
      setSavingSettings(false);
    }
  };

  const hasSettingsChanges = JSON.stringify(settings) !== JSON.stringify(originalSettings);

  // =============================================================================
  // Render
  // =============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Outbound</h1>
          <p className="text-muted-foreground">
            Manage campaigns, contacts, and outbound calls
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-4 w-4" />
          </Button>
          <Link href="/campaigns/create">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Calls Made</p>
                <p className="text-2xl font-bold">
                  {statsLoading ? "-" : stats.callsToday}
                </p>
              </div>
              <PhoneOutgoing className="h-8 w-8 text-muted-foreground/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Answered Rate</p>
                <p className="text-2xl font-bold text-green-600">
                  {statsLoading ? "-" : `${stats.answeredRate}%`}
                </p>
              </div>
              <TrendingUp className="h-8 w-8 text-green-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Successful</p>
                <p className="text-2xl font-bold text-blue-600">
                  {statsLoading ? "-" : stats.appointmentsBooked}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-blue-500/20" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Active Campaigns</p>
                <p className="text-2xl font-bold text-purple-600">
                  {statsLoading ? "-" : stats.activeCampaigns}
                </p>
              </div>
              <PlayCircle className="h-8 w-8 text-purple-500/20" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-2">
        <button
          onClick={() => setActiveTab("campaigns")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "campaigns"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Phone className="h-4 w-4" />
          Campaigns
        </button>
        <button
          onClick={() => setActiveTab("calls")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "calls"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <History className="h-4 w-4" />
          Call Log
        </button>
        <button
          onClick={() => setActiveTab("contacts")}
          className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === "contacts"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted"
          }`}
        >
          <Users className="h-4 w-4" />
          Contacts
        </button>
      </div>

      {/* Campaigns Tab */}
      {activeTab === "campaigns" && (
        <div className="space-y-4">
          {campaignsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : campaigns.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Phone className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No campaigns yet</h3>
                <p className="text-muted-foreground mb-4">
                  Create your first campaign to start reaching customers
                </p>
                <Link href="/campaigns/create">
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Campaign
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {campaigns.map((campaign) => (
                <Card key={campaign.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Link
                            href={`/campaigns/${campaign.id}`}
                            className="font-semibold hover:text-primary truncate"
                          >
                            {campaign.name}
                          </Link>
                          <Badge className={cn("shrink-0", getStatusColor(campaign.status))}>
                            {campaign.status}
                          </Badge>
                        </div>

                        {campaign.description && (
                          <p className="text-sm text-muted-foreground mb-3 line-clamp-1">
                            {campaign.description}
                          </p>
                        )}

                        {/* Progress */}
                        {(campaign.target_contacts || 0) > 0 && (
                          <div className="mb-3">
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-muted-foreground">
                                {campaign.calls_completed || 0} / {campaign.target_contacts} calls
                              </span>
                              <span className="font-medium">
                                {Math.round(((campaign.calls_completed || 0) / (campaign.target_contacts || 1)) * 100)}%
                              </span>
                            </div>
                            <Progress
                              value={((campaign.calls_completed || 0) / (campaign.target_contacts || 1)) * 100}
                              className="h-1.5"
                            />
                          </div>
                        )}

                        {/* Stats row */}
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Users className="h-3 w-3" />
                            {campaign.target_contacts || 0} contacts
                          </span>
                          {(campaign.calls_successful || 0) > 0 && (
                            <span className="flex items-center gap-1 text-green-600">
                              <CheckCircle2 className="h-3 w-3" />
                              {campaign.calls_successful} successful
                            </span>
                          )}
                          {campaign.scheduled_at && (
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {format(new Date(campaign.scheduled_at), "MMM d, h:mm a")}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {campaign.status === "draft" && (
                          <Button
                            size="sm"
                            onClick={() => handleCampaignAction(campaign.id, "start")}
                            disabled={campaignActionLoading === campaign.id}
                          >
                            {campaignActionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Start
                              </>
                            )}
                          </Button>
                        )}

                        {(campaign.status === "active" || campaign.status === "running") && (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleProcessCalls(campaign.id)}
                              disabled={campaignActionLoading === `process-${campaign.id}`}
                            >
                              {campaignActionLoading === `process-${campaign.id}` ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <>
                                  <Zap className="h-3 w-3 mr-1" />
                                  Process
                                </>
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              onClick={() => handleCampaignAction(campaign.id, "pause")}
                              disabled={campaignActionLoading === campaign.id}
                            >
                              <Pause className="h-3 w-3" />
                            </Button>
                          </>
                        )}

                        {campaign.status === "paused" && (
                          <Button
                            size="sm"
                            onClick={() => handleCampaignAction(campaign.id, "resume")}
                            disabled={campaignActionLoading === campaign.id}
                          >
                            {campaignActionLoading === campaign.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <>
                                <Play className="h-3 w-3 mr-1" />
                                Resume
                              </>
                            )}
                          </Button>
                        )}

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem asChild>
                              <Link href={`/campaigns/${campaign.id}`}>View Details</Link>
                            </DropdownMenuItem>
                            {(campaign.status === "active" || campaign.status === "running" || campaign.status === "paused") && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleCampaignAction(campaign.id, "cancel")}
                                >
                                  <StopCircle className="h-4 w-4 mr-2" />
                                  Cancel
                                </DropdownMenuItem>
                              </>
                            )}
                            {campaign.status !== "active" && campaign.status !== "running" && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => handleDeleteCampaign(campaign.id)}
                                >
                                  <Trash2 className="h-4 w-4 mr-2" />
                                  Delete
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Call Log Tab */}
      {activeTab === "calls" && (
        <div className="space-y-4">
          {callsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : calls.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <History className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No outbound calls yet</h3>
                <p className="text-muted-foreground">
                  Start a campaign to begin making calls
                </p>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0 divide-y">
                  {calls.map((call) => (
                    <div
                      key={call.id}
                      className="p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                            <PhoneOutgoing className="h-5 w-5 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium truncate">
                              {call.caller_name || formatPhoneNumber(call.to_number)}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {call.direction === "outbound" ? "Outbound call" : "Call"}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-4 shrink-0">
                          <div className="text-right hidden sm:block">
                            <p className="text-sm font-medium">
                              {formatDuration(call.duration_seconds || 0)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {call.started_at ? format(new Date(call.started_at), "MMM d, h:mm a") : format(new Date(call.created_at), "MMM d, h:mm a")}
                            </p>
                          </div>

                          <Badge
                            className={cn(
                              call.outcome === "appointment_booked" || call.outcome === "successful"
                                ? "bg-green-500/10 text-green-600"
                                : call.outcome === "voicemail" || call.outcome === "callback_requested"
                                ? "bg-yellow-500/10 text-yellow-600"
                                : "bg-gray-500/10 text-gray-600"
                            )}
                          >
                            {call.outcome || "completed"}
                          </Badge>

                          {call.recording_url && (
                            <audio
                              controls
                              src={call.recording_url}
                              className="h-8 w-32"
                            />
                          )}
                        </div>
                      </div>

                      {call.summary && (
                        <p className="mt-2 text-sm text-muted-foreground line-clamp-2 pl-13">
                          {call.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Pagination */}
              {callsTotal > 20 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {callsPage} of {Math.ceil(callsTotal / 20)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCallsPage(p => p - 1)}
                      disabled={callsPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCallsPage(p => p + 1)}
                      disabled={callsPage >= Math.ceil(callsTotal / 20)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Contacts Tab */}
      {activeTab === "contacts" && (
        <div className="space-y-4">
          {/* Search and actions bar */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex gap-2">
              <Input
                placeholder="Search contacts..."
                value={contactSearch}
                onChange={(e) => setContactSearch(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && fetchContacts()}
                className="max-w-sm"
              />
              <Button variant="secondary" size="icon" onClick={() => fetchContacts()}>
                <Search className="h-4 w-4" />
              </Button>
            </div>
            <div className="flex gap-2">
              {selectedContacts.size > 0 && (
                <>
                  <Link href={`/campaigns/create?contacts=${Array.from(selectedContacts).join(",")}`}>
                    <Button variant="secondary">
                      <Phone className="h-4 w-4 mr-2" />
                      Create Campaign ({selectedContacts.size})
                    </Button>
                  </Link>
                  <Button
                    variant="destructive"
                    onClick={() => setDeleteDialogOpen(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete ({selectedContacts.size})
                  </Button>
                </>
              )}
              <Button
                variant="outline"
                onClick={() => setImportDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-2" />
                Import
              </Button>
              <Button variant="outline" onClick={() => setCreateContactOpen(true)}>
                <UserPlus className="h-4 w-4 mr-2" />
                Add Contact
              </Button>
            </div>
          </div>

          {contactsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : contacts.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Users className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" />
                <h3 className="text-lg font-medium mb-2">No contacts yet</h3>
                <p className="text-muted-foreground mb-4">
                  Add contacts to start building your outreach list
                </p>
                <Button onClick={() => setCreateContactOpen(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Add Contact
                </Button>
              </CardContent>
            </Card>
          ) : (
            <>
              <Card>
                <CardContent className="p-0">
                  {/* Header */}
                  <div className="hidden md:grid grid-cols-12 gap-4 px-4 py-3 text-sm font-medium text-muted-foreground bg-muted/50 border-b">
                    <div className="col-span-1 flex items-center">
                      <Checkbox
                        checked={selectedContacts.size === contacts.length}
                        onCheckedChange={handleSelectAll}
                      />
                    </div>
                    <div className="col-span-3">Name</div>
                    <div className="col-span-3">Phone</div>
                    <div className="col-span-3">Email</div>
                    <div className="col-span-1 text-center">Calls</div>
                    <div className="col-span-1 text-center">VIP</div>
                  </div>

                  {/* Rows */}
                  <div className="divide-y">
                    {contacts.map((contact) => (
                      <div
                        key={contact.id}
                        className={cn(
                          "grid grid-cols-12 gap-4 px-4 py-3 items-center hover:bg-muted/50 transition-colors",
                          selectedContacts.has(contact.id) && "bg-primary/5"
                        )}
                      >
                        <div className="col-span-1">
                          <Checkbox
                            checked={selectedContacts.has(contact.id)}
                            onCheckedChange={() => handleContactSelect(contact.id)}
                          />
                        </div>
                        <div className="col-span-3 min-w-0">
                          <p className="font-medium truncate">
                            {contact.name || "Unknown"}
                          </p>
                        </div>
                        <div className="col-span-3 flex items-center gap-2 min-w-0">
                          <Phone className="h-4 w-4 text-muted-foreground shrink-0" />
                          <span className="text-sm truncate">
                            {formatPhoneNumber(contact.phone_number)}
                          </span>
                        </div>
                        <div className="col-span-3 min-w-0">
                          {contact.email ? (
                            <div className="flex items-center gap-2">
                              <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="text-sm truncate">{contact.email}</span>
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">-</span>
                          )}
                        </div>
                        <div className="col-span-1 text-center text-sm">
                          {contact.total_calls}
                        </div>
                        <div className="col-span-1 flex justify-center">
                          {contact.vip_status && (
                            <Badge className="bg-amber-500/10 text-amber-600">
                              <Star className="h-3 w-3 mr-1 fill-current" />
                              VIP
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pagination */}
              {contactsTotal > 20 && (
                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {contactsPage} of {Math.ceil(contactsTotal / 20)}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setContactsPage(p => p - 1)}
                      disabled={contactsPage <= 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setContactsPage(p => p + 1)}
                      disabled={contactsPage >= Math.ceil(contactsTotal / 20)}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Settings Sheet */}
      <Sheet open={settingsOpen} onOpenChange={setSettingsOpen}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Settings className="h-5 w-5" />
              Outbound Settings
            </SheetTitle>
            <SheetDescription>
              Configure calling hours, limits, and reminder preferences
            </SheetDescription>
          </SheetHeader>

          {settingsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-6 py-6">
              {/* Enable Reminders */}
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg">
                    <Bell className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="font-medium">Reminder Calls</Label>
                    <p className="text-xs text-muted-foreground">
                      Auto-call for appointment reminders
                    </p>
                  </div>
                </div>
                <Switch
                  checked={settings.reminder_calls_enabled}
                  onCheckedChange={(checked) =>
                    setSettings(s => ({ ...s, reminder_calls_enabled: checked }))
                  }
                />
              </div>

              {settings.reminder_calls_enabled && (
                <>
                  {/* Reminder Timing */}
                  <div className="space-y-3">
                    <Label className="font-medium">Reminder Timing</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="flex items-center gap-2 p-3 border rounded-lg">
                        <Checkbox
                          checked={settings.reminder_24hr_enabled}
                          onCheckedChange={(checked) =>
                            setSettings(s => ({ ...s, reminder_24hr_enabled: checked === true }))
                          }
                        />
                        <Label className="text-sm cursor-pointer">24 hours before</Label>
                      </div>
                      <div className="flex items-center gap-2 p-3 border rounded-lg">
                        <Checkbox
                          checked={settings.reminder_2hr_enabled}
                          onCheckedChange={(checked) =>
                            setSettings(s => ({ ...s, reminder_2hr_enabled: checked === true }))
                          }
                        />
                        <Label className="text-sm cursor-pointer">2 hours before</Label>
                      </div>
                    </div>
                  </div>

                  {/* Agent Selection */}
                  <div className="space-y-2">
                    <Label>AI Agent</Label>
                    <Select
                      value={settings.reminder_agent_id || ""}
                      onValueChange={(value) =>
                        setSettings(s => ({ ...s, reminder_agent_id: value || null }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select an agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {agents.map((agent) => (
                          <SelectItem key={agent.id} value={agent.id}>
                            {agent.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}

              {/* Daily Limit */}
              <div className="space-y-2">
                <Label>Daily Call Limit</Label>
                <Input
                  type="number"
                  min={1}
                  max={500}
                  value={settings.daily_call_limit}
                  onChange={(e) =>
                    setSettings(s => ({
                      ...s,
                      daily_call_limit: Math.min(parseInt(e.target.value, 10) || 100, 500),
                    }))
                  }
                  className="w-32"
                />
                <p className="text-xs text-muted-foreground">Max calls per day (1-500)</p>
              </div>

              {/* Calling Hours */}
              <div className="space-y-3">
                <Label className="font-medium flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Calling Hours
                </Label>
                <div className="flex items-center gap-3">
                  <Select
                    value={settings.outbound_hours_start}
                    onValueChange={(value) =>
                      setSettings(s => ({ ...s, outbound_hours_start: value }))
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatTime(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span className="text-muted-foreground">to</span>
                  <Select
                    value={settings.outbound_hours_end}
                    onValueChange={(value) =>
                      setSettings(s => ({ ...s, outbound_hours_end: value }))
                    }
                  >
                    <SelectTrigger className="w-28">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_OPTIONS.filter((t) => t > settings.outbound_hours_start).map((time) => (
                        <SelectItem key={time} value={time}>
                          {formatTime(time)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Timezone */}
              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select
                  value={settings.timezone}
                  onValueChange={(value) => setSettings(s => ({ ...s, timezone: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Save Button */}
              <Button
                onClick={handleSaveSettings}
                disabled={savingSettings || !hasSettingsChanges}
                className="w-full"
              >
                {savingSettings ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Save className="h-4 w-4 mr-2" />
                )}
                Save Settings
              </Button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Contact Dialog */}
      <Dialog open={createContactOpen} onOpenChange={setCreateContactOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Contact
            </DialogTitle>
            <DialogDescription>
              Add a new contact to your outreach list
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Phone <span className="text-destructive">*</span></Label>
              <Input
                type="tel"
                placeholder="(555) 123-4567"
                value={newContact.phone}
                onChange={(e) => setNewContact(c => ({ ...c, phone: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Name</Label>
              <Input
                placeholder="Contact name"
                value={newContact.name}
                onChange={(e) => setNewContact(c => ({ ...c, name: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input
                type="email"
                placeholder="contact@example.com"
                value={newContact.email}
                onChange={(e) => setNewContact(c => ({ ...c, email: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea
                placeholder="Optional notes..."
                value={newContact.notes}
                onChange={(e) => setNewContact(c => ({ ...c, notes: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateContactOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateContact} disabled={creatingContact}>
              {creatingContact ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <UserPlus className="h-4 w-4 mr-2" />
              )}
              Add Contact
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import Contacts Dialog */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Contacts
            </DialogTitle>
            <DialogDescription>
              Paste contacts or upload a file. Format: <code className="bg-muted px-1 rounded">name, phone, email</code> (one per line)
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Drag and drop area */}
            <div
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
            >
              <FileText className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground">
                Drag and drop a file here, or click to browse
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Supports .txt, .csv, .tsv
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.csv,.tsv"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Text area for contacts */}
            <div className="space-y-2">
              <Label>Contact List</Label>
              <Textarea
                placeholder={"John Doe, (555) 123-4567, john@example.com\nJane Smith, 555-987-6543, jane@example.com\n(555) 111-2222"}
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                rows={8}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                {importText.split(/\r?\n/).filter(l => l.trim()).length} lines
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setImportDialogOpen(false);
                setImportText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={processImportText} disabled={importingContacts || !importText.trim()}>
              {importingContacts ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Import Contacts
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Contacts Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              Delete Contacts
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete {selectedContacts.size} contact{selectedContacts.size !== 1 ? "s" : ""}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelectedContacts}
              disabled={deletingContacts}
            >
              {deletingContacts ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 mr-2" />
              )}
              Delete {selectedContacts.size} Contact{selectedContacts.size !== 1 ? "s" : ""}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
