"use client";

/**
 * Call Detail Sections
 * Sub-components for displaying call details in the side panel
 */

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import {
  Play,
  Calendar,
  User,
  FileText,
  MessageSquare,
  Download,
} from "lucide-react";
import type { Call, Appointment } from "@/types";
import { ChatTranscript } from "@/components/ui/chat-transcript";
import { formatDuration, getOutcomeConfig } from "./calls-list";
import { useTranslations } from "next-intl";

interface CallMetadataProps {
  call: Call;
  config: ReturnType<typeof getOutcomeConfig>;
}

export function CallMetadata({ call, config }: CallMetadataProps) {
  const t = useTranslations("calls");

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs text-muted-foreground">{t("duration")}</p>
        <p className="font-medium">{formatDuration(call.duration_seconds)}</p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t("language")}</p>
        <p className="font-medium">
          {call.language === "es" ? t("spanish") : t("english")}
        </p>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t("outcome")}</p>
        <Badge variant="secondary" className={cn(config.className)}>
          {config.label}
        </Badge>
      </div>
      <div>
        <p className="text-xs text-muted-foreground">{t("billedMinutes")}</p>
        <p className="font-medium">{call.duration_minutes_billed || 0} min</p>
      </div>
    </div>
  );
}

export function CallSummary({ summary }: { summary: string }) {
  const t = useTranslations("calls");

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <FileText className="h-4 w-4" />
        {t("summary")}
      </h4>
      <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
        {summary}
      </p>
    </div>
  );
}

export function CallMessage({ message }: { message: string }) {
  const t = useTranslations("calls");

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <MessageSquare className="h-4 w-4" />
        {t("messageTaken")}
      </h4>
      <p className="text-sm text-muted-foreground bg-muted rounded-lg p-3">
        {message}
      </p>
    </div>
  );
}

export function CallLeadInfo({ leadInfo }: { leadInfo: Record<string, unknown> }) {
  const t = useTranslations("calls");

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <User className="h-4 w-4" />
        {t("leadInfo")}
      </h4>
      <div className="bg-muted rounded-lg p-3 space-y-2">
        {Object.entries(leadInfo).map(([key, value]) => (
          <div key={key} className="flex justify-between text-sm">
            <span className="text-muted-foreground capitalize">
              {key.replace(/_/g, " ")}
            </span>
            <span className="font-medium">{String(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CallAppointment({ appointment }: { appointment: Appointment }) {
  const t = useTranslations("calls");

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
        <Calendar className="h-4 w-4" />
        {t("appointmentBooked")}
      </h4>
      <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-lg p-3 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Service</span>
          <span className="font-medium">{appointment.service_name}</span>
        </div>
        {appointment.scheduled_at && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Date & Time</span>
            <span className="font-medium">
              {format(new Date(appointment.scheduled_at), "MMM d, yyyy 'at' h:mm a")}
            </span>
          </div>
        )}
        {appointment.customer_name && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Customer</span>
            <span className="font-medium">{appointment.customer_name}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function CallRecording({ call }: { call: Call }) {
  const t = useTranslations("calls");

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = call.recording_url!;
    link.download = `call-${call.id}-${format(new Date(call.created_at), "yyyy-MM-dd")}.mp3`;
    link.target = "_blank";
    link.click();
  };

  return (
    <div>
      <h4 className="text-sm font-medium mb-2 flex items-center justify-between">
        <span className="flex items-center gap-2">
          <Play className="h-4 w-4" />
          {t("recording")}
        </span>
        <Button variant="outline" size="sm" className="gap-2" onClick={handleDownload}>
          <Download className="h-4 w-4" />
          {t("download")}
        </Button>
      </h4>
      <audio controls className="w-full" src={`/api/dashboard/calls/${call.id}/recording`} />
    </div>
  );
}

export function CallTranscriptSection({ transcript }: { transcript: Record<string, unknown> }) {
  const t = useTranslations("calls");

  return (
    <div>
      <h4 className="text-sm font-medium mb-2">{t("transcript")}</h4>
      <div className="bg-muted/50 rounded-lg p-4 max-h-80 overflow-y-auto">
        <ChatTranscript transcript={transcript} agentName="Koya" />
      </div>
    </div>
  );
}
