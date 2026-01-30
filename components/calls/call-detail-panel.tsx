"use client";

/**
 * Call Detail Panel Component
 * Side panel showing full call details including metadata, transcript, recording
 */

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { format } from "date-fns";
import { Phone, Loader2 } from "lucide-react";
import type { Call, Appointment } from "@/types";
import { CallNotes } from "./call-notes";
import { formatPhoneNumber, getOutcomeConfig } from "./calls-list";
import {
  CallMetadata,
  CallSummary,
  CallMessage,
  CallLeadInfo,
  CallAppointment,
  CallRecording,
  CallTranscriptSection,
} from "./call-detail-sections";

export interface CallDetailPanelProps {
  call: Call | null;
  appointment: Appointment | null;
  detailsLoading: boolean;
  isOpen: boolean;
  onClose: () => void;
  noteText: string;
  onNoteChange: (text: string) => void;
  onSaveNote: () => Promise<void>;
  onToggleFlag: (call: Call) => Promise<void>;
  savingNote: boolean;
}

export function CallDetailPanel({
  call,
  appointment,
  detailsLoading,
  isOpen,
  onClose,
  noteText,
  onNoteChange,
  onSaveNote,
  onToggleFlag,
  savingNote,
}: CallDetailPanelProps) {
  if (!call) return null;

  const config = getOutcomeConfig(call.outcome);

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            {formatPhoneNumber(call.from_number)}
          </SheetTitle>
          <SheetDescription>
            {format(
              new Date(call.started_at || call.created_at),
              "EEEE, MMMM d, yyyy 'at' h:mm a"
            )}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <CallMetadata call={call} config={config} />
          {call.summary && <CallSummary summary={call.summary} />}
          {call.message_taken && <CallMessage message={call.message_taken} />}
          {call.lead_info && Object.keys(call.lead_info).length > 0 && (
            <CallLeadInfo leadInfo={call.lead_info} />
          )}

          {detailsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            appointment && <CallAppointment appointment={appointment} />
          )}

          {call.recording_url && <CallRecording call={call} />}
          {call.transcript && <CallTranscriptSection transcript={call.transcript} />}

          <CallNotes
            call={call}
            noteText={noteText}
            onNoteChange={onNoteChange}
            onSaveNote={onSaveNote}
            onToggleFlag={onToggleFlag}
            savingNote={savingNote}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
