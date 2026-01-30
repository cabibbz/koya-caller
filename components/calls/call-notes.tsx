"use client";

/**
 * Call Notes Component
 * Handles notes editing and flagging functionality for calls
 */

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Flag, Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Call } from "@/types";

export interface CallNotesProps {
  call: Call;
  noteText: string;
  onNoteChange: (text: string) => void;
  onSaveNote: () => Promise<void>;
  onToggleFlag: (call: Call) => Promise<void>;
  savingNote: boolean;
}

export function CallNotes({
  call,
  noteText,
  onNoteChange,
  onSaveNote,
  onToggleFlag,
  savingNote,
}: CallNotesProps) {
  const t = useTranslations("calls");
  const tCommon = useTranslations("common");

  return (
    <div className="border-t pt-6 space-y-4">
      <div className="flex gap-2">
        <Button
          variant={call.flagged ? "destructive" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => onToggleFlag(call)}
        >
          <Flag className="h-4 w-4" />
          {call.flagged ? t("unflag") : t("flag")}
        </Button>
      </div>

      {/* Notes */}
      <div>
        <Label htmlFor="notes" className="text-sm font-medium">
          {tCommon("notes")}
        </Label>
        <Textarea
          id="notes"
          placeholder={`${tCommon("add")} ${tCommon("notes").toLowerCase()}...`}
          value={noteText}
          onChange={(e) => onNoteChange(e.target.value)}
          className="mt-2"
          rows={3}
        />
        <Button
          size="sm"
          className="mt-2"
          onClick={onSaveNote}
          disabled={savingNote}
        >
          {savingNote ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              {tCommon("saving")}
            </>
          ) : (
            t("saveNote")
          )}
        </Button>
      </div>
    </div>
  );
}

export interface UseCallNotesOptions {
  onSuccess?: () => void;
  onError?: (error: string) => void;
}

export function useCallNotes(options: UseCallNotesOptions = {}) {
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  const initializeNote = (call: Call) => {
    setNoteText(call.notes || "");
  };

  const saveNote = async (callId: string) => {
    setSavingNote(true);
    try {
      const res = await fetch("/api/dashboard/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: callId, notes: noteText }),
      });
      if (!res.ok) {
        options.onError?.("Failed to save note");
        return false;
      }
      options.onSuccess?.();
      return true;
    } catch (_error) {
      options.onError?.("Network error occurred");
      return false;
    } finally {
      setSavingNote(false);
    }
  };

  const toggleFlag = async (call: Call) => {
    try {
      const res = await fetch("/api/dashboard/calls", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: call.id, flagged: !call.flagged }),
      });
      if (!res.ok) {
        options.onError?.("Failed to update flag");
        return false;
      }
      options.onSuccess?.();
      return true;
    } catch (_error) {
      options.onError?.("Network error occurred");
      return false;
    }
  };

  return {
    noteText,
    setNoteText,
    savingNote,
    initializeNote,
    saveNote,
    toggleFlag,
  };
}
