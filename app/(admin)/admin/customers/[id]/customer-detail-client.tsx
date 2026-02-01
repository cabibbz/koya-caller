"use client";

/**
 * Admin Customer Detail Client Component
 * View and edit all aspects of a business
 */

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Building2,
  Phone,
  Clock,
  Save,
  Loader2,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Mic,
  FileText,
  List,
  MapPin,
} from "lucide-react";

interface BusinessDetail {
  id: string;
  name: string;
  industry: string;
  description: string;
  phone: string;
  address: string;
  website: string;
  subscription_status: string;
  minutes_used_this_cycle: number;
  minutes_included: number;
  created_at: string;
  user: {
    email: string;
    phone: string;
  };
  plan: {
    name: string;
    price_cents: number;
  };
  ai_config: {
    voice_id: string;
    personality: string;
    custom_greeting: string;
    after_hours_greeting: string;
    language_mode: string;
    spanish_enabled: boolean;
  };
  call_settings: {
    transfer_number: string;
    after_hours_action: string;
    max_call_duration: number;
    emergency_keywords: string[];
  };
  business_hours: Array<{
    day_of_week: number;
    is_open: boolean;
    open_time: string;
    close_time: string;
  }>;
  services: Array<{
    id: string;
    name: string;
    duration_minutes: number;
    price_cents: number;
    description: string;
  }>;
  faqs: Array<{
    id: string;
    question: string;
    answer: string;
  }>;
  recent_calls: Array<{
    id: string;
    started_at: string;
    duration_seconds: number;
    outcome: string;
    caller_number: string;
  }>;
  phone_numbers: Array<{
    id: string;
    number: string;
    location_name: string | null;
    location_address: string | null;
    is_active: boolean;
  }>;
}

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function CustomerDetailClient({ businessId }: { businessId: string }) {
  const [business, setBusiness] = useState<BusinessDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Editable state
  const [editedBusiness, setEditedBusiness] = useState<Partial<BusinessDetail>>({});
  const [editedAiConfig, setEditedAiConfig] = useState<Partial<BusinessDetail["ai_config"]>>({});
  const [editedCallSettings, setEditedCallSettings] = useState<Partial<BusinessDetail["call_settings"]>>({});

  const fetchBusiness = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${businessId}`);
      if (!res.ok) {
        throw new Error("Failed to fetch business");
      }
      const data = await res.json();
      setBusiness(data.business);
      setEditedBusiness({
        name: data.business.name,
        industry: data.business.industry,
        description: data.business.description,
        phone: data.business.phone,
        address: data.business.address,
        website: data.business.website,
      });
      setEditedAiConfig(data.business.ai_config || {});
      setEditedCallSettings(data.business.call_settings || {});
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    fetchBusiness();
  }, [fetchBusiness]);

  const handleSave = async (section: string) => {
    setSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      let payload: any = {};

      if (section === "business") {
        payload = { business: editedBusiness };
      } else if (section === "ai_config") {
        payload = { ai_config: editedAiConfig };
      } else if (section === "call_settings") {
        payload = { call_settings: editedCallSettings };
      }

      const res = await fetch(`/api/admin/customers/${businessId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error("Failed to save changes");
      }

      setSuccessMessage(`${section.replace("_", " ")} updated successfully`);
      setTimeout(() => setSuccessMessage(null), 3000);
      fetchBusiness();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error && !business) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchBusiness} variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    );
  }

  if (!business) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{business.name}</h1>
            <p className="text-muted-foreground">{business.user?.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-3 py-1 rounded-full text-sm font-medium ${
            business.subscription_status === "active"
              ? "bg-emerald-500/10 text-emerald-500"
              : business.subscription_status === "paused"
              ? "bg-amber-500/10 text-amber-500"
              : "bg-red-500/10 text-red-500"
          }`}>
            {business.subscription_status}
          </span>
          <Button onClick={fetchBusiness} variant="outline" size="sm">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Success/Error Messages */}
      {successMessage && (
        <div className="bg-emerald-500/10 text-emerald-500 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="h-4 w-4" />
          {successMessage}
        </div>
      )}
      {error && (
        <div className="bg-red-500/10 text-red-500 px-4 py-3 rounded-lg flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Clock className="h-4 w-4" />
              <span className="text-sm">Usage</span>
            </div>
            <p className="text-2xl font-bold">
              {business.minutes_used_this_cycle}/{business.minutes_included} min
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <Phone className="h-4 w-4" />
              <span className="text-sm">Recent Calls</span>
            </div>
            <p className="text-2xl font-bold">{business.recent_calls?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <List className="h-4 w-4" />
              <span className="text-sm">Services</span>
            </div>
            <p className="text-2xl font-bold">{business.services?.length || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <FileText className="h-4 w-4" />
              <span className="text-sm">FAQs</span>
            </div>
            <p className="text-2xl font-bold">{business.faqs?.length || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Main Content Tabs */}
      <Tabs defaultValue="business">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="business" className="gap-2">
            <Building2 className="h-4 w-4" />
            Business
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <MapPin className="h-4 w-4" />
            Locations
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Mic className="h-4 w-4" />
            AI Config
          </TabsTrigger>
          <TabsTrigger value="calls" className="gap-2">
            <Phone className="h-4 w-4" />
            Call Settings
          </TabsTrigger>
          <TabsTrigger value="hours" className="gap-2">
            <Clock className="h-4 w-4" />
            Hours
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-2">
            <List className="h-4 w-4" />
            Services
          </TabsTrigger>
        </TabsList>

        {/* Business Info Tab */}
        <TabsContent value="business">
          <Card>
            <CardHeader>
              <CardTitle>Business Information</CardTitle>
              <CardDescription>Basic business details and contact info</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Business Name</Label>
                  <Input
                    value={editedBusiness.name || ""}
                    onChange={(e) => setEditedBusiness({ ...editedBusiness, name: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Industry</Label>
                  <Input
                    value={editedBusiness.industry || ""}
                    onChange={(e) => setEditedBusiness({ ...editedBusiness, industry: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Description</Label>
                <Textarea
                  value={editedBusiness.description || ""}
                  onChange={(e) => setEditedBusiness({ ...editedBusiness, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Phone</Label>
                  <Input
                    value={editedBusiness.phone || ""}
                    onChange={(e) => setEditedBusiness({ ...editedBusiness, phone: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Website</Label>
                  <Input
                    value={editedBusiness.website || ""}
                    onChange={(e) => setEditedBusiness({ ...editedBusiness, website: e.target.value })}
                  />
                </div>
              </div>
              <div>
                <Label>Address</Label>
                <Input
                  value={editedBusiness.address || ""}
                  onChange={(e) => setEditedBusiness({ ...editedBusiness, address: e.target.value })}
                />
              </div>
              <Button onClick={() => handleSave("business")} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Locations Tab */}
        <TabsContent value="locations">
          <Card>
            <CardHeader>
              <CardTitle>Phone Numbers & Locations</CardTitle>
              <CardDescription>Manage phone numbers and their associated locations</CardDescription>
            </CardHeader>
            <CardContent>
              {!business.phone_numbers || business.phone_numbers.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No phone numbers configured</p>
              ) : (
                <div className="space-y-4">
                  {business.phone_numbers.map((phone) => (
                    <div key={phone.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <Phone className="h-5 w-5 text-muted-foreground" />
                          <span className="font-mono font-medium">{phone.number}</span>
                          {phone.is_active ? (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-emerald-500/10 text-emerald-500">Active</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-xs bg-red-500/10 text-red-500">Inactive</span>
                          )}
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-xs">Location Name</Label>
                          <Input
                            placeholder="e.g., Downtown Office"
                            defaultValue={phone.location_name || ""}
                            className="mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Location Address</Label>
                          <Input
                            placeholder="123 Main St, City, ST"
                            defaultValue={phone.location_address || ""}
                            className="mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-4">
                Each phone number can be assigned to a specific location for tracking and routing purposes.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* AI Config Tab */}
        <TabsContent value="ai">
          <Card>
            <CardHeader>
              <CardTitle>AI Configuration</CardTitle>
              <CardDescription>Voice, personality, and greeting settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Voice ID</Label>
                  <Input
                    value={editedAiConfig.voice_id || ""}
                    onChange={(e) => setEditedAiConfig({ ...editedAiConfig, voice_id: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Personality</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={editedAiConfig.personality || "professional"}
                    onChange={(e) => setEditedAiConfig({ ...editedAiConfig, personality: e.target.value })}
                  >
                    <option value="professional">Professional</option>
                    <option value="friendly">Friendly</option>
                    <option value="casual">Casual</option>
                  </select>
                </div>
              </div>
              <div>
                <Label>Custom Greeting</Label>
                <Textarea
                  value={editedAiConfig.custom_greeting || ""}
                  onChange={(e) => setEditedAiConfig({ ...editedAiConfig, custom_greeting: e.target.value })}
                  rows={2}
                  placeholder="e.g., Thank you for calling [Business]. How can I help you today?"
                />
              </div>
              <div>
                <Label>After Hours Greeting</Label>
                <Textarea
                  value={editedAiConfig.after_hours_greeting || ""}
                  onChange={(e) => setEditedAiConfig({ ...editedAiConfig, after_hours_greeting: e.target.value })}
                  rows={2}
                  placeholder="e.g., Thanks for calling. We're currently closed..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Language Mode</Label>
                  <select
                    className="w-full h-10 px-3 rounded-md border border-input bg-background"
                    value={editedAiConfig.language_mode || "auto"}
                    onChange={(e) => setEditedAiConfig({ ...editedAiConfig, language_mode: e.target.value })}
                  >
                    <option value="auto">Auto-detect</option>
                    <option value="ask">Ask caller</option>
                    <option value="english_only">English only</option>
                    <option value="spanish_default">Spanish default</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 pt-6">
                  <Switch
                    checked={editedAiConfig.spanish_enabled || false}
                    onCheckedChange={(checked) => setEditedAiConfig({ ...editedAiConfig, spanish_enabled: checked })}
                  />
                  <Label>Spanish Support Enabled</Label>
                </div>
              </div>
              <Button onClick={() => handleSave("ai_config")} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save AI Config
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Call Settings Tab */}
        <TabsContent value="calls">
          <Card>
            <CardHeader>
              <CardTitle>Call Settings</CardTitle>
              <CardDescription>Transfer, after-hours, and call handling options</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Transfer Number</Label>
                  <Input
                    value={editedCallSettings.transfer_number || ""}
                    onChange={(e) => setEditedCallSettings({ ...editedCallSettings, transfer_number: e.target.value })}
                    placeholder="+1234567890"
                  />
                </div>
                <div>
                  <Label>Max Call Duration (seconds)</Label>
                  <Input
                    type="number"
                    value={editedCallSettings.max_call_duration || 600}
                    onChange={(e) => setEditedCallSettings({ ...editedCallSettings, max_call_duration: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div>
                <Label>After Hours Action</Label>
                <select
                  className="w-full h-10 px-3 rounded-md border border-input bg-background"
                  value={editedCallSettings.after_hours_action || "voicemail"}
                  onChange={(e) => setEditedCallSettings({ ...editedCallSettings, after_hours_action: e.target.value })}
                >
                  <option value="voicemail">Take voicemail</option>
                  <option value="transfer">Transfer to number</option>
                  <option value="message">Play message and hang up</option>
                  <option value="book">Allow booking only</option>
                </select>
              </div>
              <div>
                <Label>Emergency Keywords (comma separated)</Label>
                <Input
                  value={(editedCallSettings.emergency_keywords || []).join(", ")}
                  onChange={(e) => setEditedCallSettings({
                    ...editedCallSettings,
                    emergency_keywords: e.target.value.split(",").map(k => k.trim()).filter(Boolean)
                  })}
                  placeholder="emergency, urgent, 911"
                />
              </div>
              <Button onClick={() => handleSave("call_settings")} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                Save Call Settings
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Business Hours Tab */}
        <TabsContent value="hours">
          <Card>
            <CardHeader>
              <CardTitle>Business Hours</CardTitle>
              <CardDescription>Operating hours for each day of the week</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {business.business_hours?.map((day, index) => (
                  <div key={index} className="flex items-center gap-4 p-3 border rounded-lg">
                    <div className="w-24 font-medium">{DAYS[day.day_of_week]}</div>
                    <Switch checked={day.is_open} disabled />
                    {day.is_open ? (
                      <div className="flex items-center gap-2 text-sm">
                        <span>{day.open_time}</span>
                        <span className="text-muted-foreground">to</span>
                        <span>{day.close_time}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-sm">Closed</span>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mt-4">
                Hours can be edited from the business owner&apos;s dashboard
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Services Tab */}
        <TabsContent value="services">
          <Card>
            <CardHeader>
              <CardTitle>Services</CardTitle>
              <CardDescription>Services offered by this business</CardDescription>
            </CardHeader>
            <CardContent>
              {business.services?.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">No services configured</p>
              ) : (
                <div className="space-y-3">
                  {business.services?.map((service) => (
                    <div key={service.id} className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-medium">{service.name}</h4>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>{service.duration_minutes} min</span>
                          <span>${(service.price_cents / 100).toFixed(2)}</span>
                        </div>
                      </div>
                      {service.description && (
                        <p className="text-sm text-muted-foreground">{service.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Recent Calls */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Calls</CardTitle>
          <CardDescription>Last 10 calls for this business</CardDescription>
        </CardHeader>
        <CardContent>
          {business.recent_calls?.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No calls yet</p>
          ) : (
            <div className="space-y-2">
              {business.recent_calls?.map((call) => (
                <div key={call.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="font-medium">{call.caller_number || "Unknown"}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(call.started_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-sm text-muted-foreground">
                      {Math.floor(call.duration_seconds / 60)}:{(call.duration_seconds % 60).toString().padStart(2, "0")}
                    </span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      call.outcome === "booked" ? "bg-emerald-500/10 text-emerald-500" :
                      call.outcome === "transferred" ? "bg-blue-500/10 text-blue-500" :
                      call.outcome === "info_provided" ? "bg-purple-500/10 text-purple-500" :
                      "bg-muted text-muted-foreground"
                    }`}>
                      {call.outcome}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
