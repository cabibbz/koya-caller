"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  Mail,
  Calendar,
  CheckCircle,
  LogOut,
  ExternalLink,
  Link2,
  Save,
  MessageSquare,
} from "lucide-react";

// Google and Microsoft icons as SVGs
const GoogleIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const MicrosoftIcon = () => (
  <svg className="w-5 h-5" viewBox="0 0 24 24">
    <path fill="#F25022" d="M1 1h10v10H1z"/>
    <path fill="#00A4EF" d="M1 13h10v10H1z"/>
    <path fill="#7FBA00" d="M13 1h10v10H13z"/>
    <path fill="#FFB900" d="M13 13h10v10H13z"/>
  </svg>
);

interface ConnectionData {
  connected: boolean;
  provider: string | null;
  email: string | null;
  connectedAt: string | null;
  calendarId: string | null;
  features: {
    calendar: boolean;
    email: boolean;
    scheduler: boolean;
  };
  calendars: Array<{
    id: string;
    name: string;
    isPrimary: boolean;
    readOnly: boolean;
  }>;
  folders: Array<{
    id: string;
    name: string;
    unreadCount?: number;
  }>;
  bookingPageUrl: string | null;
  bookingLinkDelivery: "sms" | "email" | "both";
}

export function ConnectionsClient() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [data, setData] = useState<ConnectionData | null>(null);
  const [bookingUrl, setBookingUrl] = useState("");
  const [bookingDelivery, setBookingDelivery] = useState<"sms" | "email" | "both">("sms");
  const [savingBookingUrl, setSavingBookingUrl] = useState(false);
  const [bookingUrlSaved, setBookingUrlSaved] = useState(false);

  const fetchConnection = async () => {
    try {
      const res = await fetch("/api/dashboard/connections");
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
      setBookingUrl(json.bookingPageUrl || "");
      setBookingDelivery(json.bookingLinkDelivery || "sms");
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

  const handleSaveBookingSettings = async () => {
    setSavingBookingUrl(true);
    setBookingUrlSaved(false);
    try {
      const res = await fetch("/api/dashboard/connections", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingPageUrl: bookingUrl,
          bookingLinkDelivery: bookingDelivery,
        }),
      });
      if (res.ok) {
        setBookingUrlSaved(true);
        setTimeout(() => setBookingUrlSaved(false), 3000);
      }
    } finally {
      setSavingBookingUrl(false);
    }
  };

  const handleConnect = async (provider?: "google" | "microsoft") => {
    setConnecting(provider || "google");
    try {
      const res = await fetch("/api/calendar/nylas/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          returnUrl: "/connections",
          provider,
        }),
      });
      const json = await res.json();
      // success() wraps in { data: { authUrl } }
      const authUrl = json.data?.authUrl || json.authUrl;
      if (authUrl) {
        window.location.href = authUrl;
      } else {
        setConnecting(null);
      }
    } catch {
      setConnecting(null);
    }
  };

  const handleDisconnect = async () => {
    if (!confirm("Disconnect your account? Calendar sync and email features will stop working.")) return;
    setDisconnecting(true);
    try {
      await fetch("/api/dashboard/settings/calendar", { method: "DELETE" });
      await fetchConnection();
    } finally {
      setDisconnecting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold">Connections</h1>
        <p className="text-muted-foreground">
          Connect your accounts to enable calendar sync and email features.
        </p>
      </div>

      {/* Connected State */}
      {data?.connected ? (
        <Card className="border-green-500/20 bg-green-500/5">
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center shadow-sm">
                  {data.provider === "microsoft" || data.provider === "outlook" ? (
                    <MicrosoftIcon />
                  ) : (
                    <GoogleIcon />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">
                      {data.provider === "microsoft" || data.provider === "outlook" ? "Microsoft" : "Google"} Account
                    </h3>
                    <Badge className="bg-green-500 text-white text-xs">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Connected
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{data.email}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      Calendar sync
                    </span>
                    <span className="flex items-center gap-1">
                      <Mail className="w-3 h-3" />
                      Email enabled
                    </span>
                  </div>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
                className="text-muted-foreground hover:text-destructive"
              >
                {disconnecting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <LogOut className="w-4 h-4" />
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Not Connected State */
        <Card>
          <CardHeader>
            <CardTitle>Connect Your Account</CardTitle>
            <CardDescription>
              Connect Google or Microsoft to enable calendar sync and send emails on your behalf.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                onClick={() => handleConnect("google")}
                disabled={!!connecting}
              >
                {connecting === "google" ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                <span className="font-medium">Connect Google</span>
                <span className="text-xs text-muted-foreground">Gmail & Google Calendar</span>
              </Button>
              <Button
                variant="outline"
                className="h-auto py-4 flex flex-col items-center gap-2 hover:border-primary hover:bg-primary/5"
                onClick={() => handleConnect("microsoft")}
                disabled={!!connecting}
              >
                {connecting === "microsoft" ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <MicrosoftIcon />
                )}
                <span className="font-medium">Connect Microsoft</span>
                <span className="text-xs text-muted-foreground">Outlook & Microsoft Calendar</span>
              </Button>
            </div>
            <div className="text-sm text-muted-foreground space-y-1 pt-2">
              <p className="font-medium text-foreground">What you get:</p>
              <ul className="space-y-1 ml-4 list-disc">
                <li>Appointments automatically added to your calendar</li>
                <li>Koya can send booking links via email from your account</li>
                <li>Real-time availability based on your calendar</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      )}

      {/* External Booking Page */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link2 className="w-5 h-5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-lg">External Booking Link</CardTitle>
              <CardDescription>
                Add your Vagaro, Calendly, Square, or other booking page URL.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="url"
              placeholder="https://your-booking-page.com"
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              className="flex-1"
            />
            <Button
              onClick={handleSaveBookingSettings}
              disabled={savingBookingUrl}
              size="sm"
            >
              {savingBookingUrl ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : bookingUrlSaved ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                <Save className="w-4 h-4" />
              )}
            </Button>
          </div>

          {bookingUrl && (
            <>
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm">
                <ExternalLink className="w-4 h-4 text-primary flex-shrink-0" />
                <a
                  href={bookingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline truncate"
                >
                  {bookingUrl}
                </a>
              </div>

              {/* Delivery Method Toggle */}
              <div className="space-y-2 pt-2">
                <p className="text-sm font-medium">How should Koya send this link?</p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => setBookingDelivery("sms")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full transition-colors ${
                      bookingDelivery === "sms"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Text Message
                  </button>
                  <button
                    onClick={() => setBookingDelivery("email")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full transition-colors ${
                      bookingDelivery === "email"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <Mail className="w-3.5 h-3.5" />
                    Email
                  </button>
                  <button
                    onClick={() => setBookingDelivery("both")}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-full transition-colors ${
                      bookingDelivery === "both"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    Both
                  </button>
                </div>
                <p className="text-xs text-muted-foreground pt-1">
                  Koya will ask callers how they'd like to receive the booking link.
                </p>
              </div>
            </>
          )}

          {!bookingUrl && (
            <p className="text-sm text-muted-foreground">
              When callers want to book, Koya will send them this link via text or email.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
