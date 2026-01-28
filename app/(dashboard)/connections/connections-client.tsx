"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Plug,
  Mail,
  Calendar,
  CalendarCheck,
  CheckCircle,
  XCircle,
  LogOut,
  ExternalLink,
} from "lucide-react";

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
}

export function ConnectionsClient() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [data, setData] = useState<ConnectionData | null>(null);

  const fetchConnection = async () => {
    try {
      const res = await fetch("/api/dashboard/connections");
      if (!res.ok) {
        setData(null);
        return;
      }
      const json = await res.json();
      setData(json);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConnection();
  }, []);

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
      if (json.authUrl) {
        window.location.href = json.authUrl;
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Connections</h1>
        <p className="text-muted-foreground">
          Connect your Google or Microsoft account to enable calendar, email, and scheduling features.
        </p>
      </div>

      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Plug className="w-5 h-5" />
              <div>
                <CardTitle>Account Connection</CardTitle>
                <CardDescription>
                  {data?.connected
                    ? `Connected as ${data.email}`
                    : "No account connected"}
                </CardDescription>
              </div>
            </div>
            {data?.connected && (
              <Badge variant="default" className="bg-green-500">
                <CheckCircle className="w-3 h-3 mr-1" />
                Active
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {data?.connected ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Calendar className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Calendar</span>
                  {data.features.calendar ? (
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 ml-auto" />
                  )}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <Mail className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Email</span>
                  {data.features.email ? (
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 ml-auto" />
                  )}
                </div>
                <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/50">
                  <CalendarCheck className="w-4 h-4 text-blue-500" />
                  <span className="text-sm">Scheduler</span>
                  {data.features.scheduler ? (
                    <CheckCircle className="w-4 h-4 text-green-500 ml-auto" />
                  ) : (
                    <XCircle className="w-4 h-4 text-red-500 ml-auto" />
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <span>Provider: {data.provider === "microsoft" ? "Microsoft" : "Google"}</span>
                {data.connectedAt && (
                  <>
                    <span>&middot;</span>
                    <span>Connected {new Date(data.connectedAt).toLocaleDateString()}</span>
                  </>
                )}
              </div>

              <Button
                variant="destructive"
                size="sm"
                onClick={handleDisconnect}
                disabled={disconnecting}
              >
                {disconnecting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <LogOut className="w-4 h-4 mr-2" />}
                Disconnect
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Connect your account to enable:
              </p>
              <ul className="text-sm space-y-1 text-muted-foreground ml-4 list-disc">
                <li>Calendar sync &mdash; appointments appear in your calendar</li>
                <li>Email inbox &mdash; read and send emails from your dashboard</li>
                <li>Online scheduling &mdash; let customers book appointments online</li>
                <li>Availability &mdash; real-time free/busy from your calendar</li>
              </ul>
              <div className="flex gap-3">
                <Button onClick={() => handleConnect("google")} disabled={!!connecting}>
                  {connecting === "google" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Connect Google
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleConnect("microsoft")}
                  disabled={!!connecting}
                >
                  {connecting === "microsoft" ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4 mr-2" />
                  )}
                  Connect Microsoft
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Calendars List */}
      {data?.connected && data.calendars.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Calendars</CardTitle>
            <CardDescription>
              Calendars from your connected account. The primary calendar is used for scheduling.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.calendars.map((cal) => (
                <div
                  key={cal.id}
                  className="flex items-center justify-between p-3 rounded-lg border"
                >
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">{cal.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {cal.isPrimary && (
                      <Badge variant="secondary" className="text-xs">
                        Primary
                      </Badge>
                    )}
                    {cal.readOnly && (
                      <Badge variant="outline" className="text-xs">
                        Read-only
                      </Badge>
                    )}
                    {cal.id === data.calendarId && (
                      <Badge className="text-xs bg-blue-500">
                        Active
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Email Folders */}
      {data?.connected && data.folders.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Email Folders</CardTitle>
            <CardDescription>
              Available email folders. Go to Inbox to read and send emails.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {data.folders.map((folder) => (
                <div
                  key={folder.id}
                  className="flex items-center justify-between p-3 rounded-lg border text-sm"
                >
                  <span>{folder.name}</span>
                  {folder.unreadCount != null && folder.unreadCount > 0 && (
                    <Badge variant="secondary" className="text-xs">
                      {folder.unreadCount}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
