/**
 * Chat Transcript Component
 * Displays call transcripts in a conversation-style UI
 */

"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Bot, User, Volume2 } from "lucide-react";
import { format } from "date-fns";

interface TranscriptMessage {
  role: "agent" | "user";
  content: string;
  timestamp?: string | number;
}

interface ChatTranscriptProps {
  transcript: string | TranscriptMessage[] | Record<string, unknown>;
  agentName?: string;
  className?: string;
}

/** Type guard to check if an object is a plain object (not null, array, or class instance) */
function isPlainObject(obj: unknown): obj is Record<string, unknown> {
  return (
    typeof obj === "object" &&
    obj !== null &&
    !Array.isArray(obj) &&
    Object.getPrototypeOf(obj) === Object.prototype
  );
}

/** Runtime validation for TranscriptMessage */
function isValidTranscriptMessage(item: unknown): item is TranscriptMessage {
  if (typeof item !== "object" || item === null) return false;
  const obj = item as Record<string, unknown>;
  return (
    (obj.role === "agent" || obj.role === "user") &&
    typeof obj.content === "string"
  );
}

/** Parse text-based transcript format */
function parseTextTranscript(text: string): TranscriptMessage[] {
  const lines = text.split("\n").filter((line) => line.trim());
  const messages: TranscriptMessage[] = [];

  for (const line of lines) {
    const agentMatch = line.match(/^(Agent|Koya|AI|Assistant):\s*(.+)/i);
    const userMatch = line.match(/^(User|Customer|Caller|Human):\s*(.+)/i);

    if (agentMatch) {
      messages.push({ role: "agent", content: agentMatch[2].trim() });
    } else if (userMatch) {
      messages.push({ role: "user", content: userMatch[2].trim() });
    } else if (line.trim() && messages.length > 0) {
      // Continuation of previous message
      messages[messages.length - 1].content += "\n" + line.trim();
    } else if (line.trim()) {
      // Default to user if no prefix
      messages.push({ role: "user", content: line.trim() });
    }
  }

  return messages;
}

function parseTranscript(
  transcript: string | TranscriptMessage[] | Record<string, unknown>
): TranscriptMessage[] {
  // If already an array, validate each item
  if (Array.isArray(transcript)) {
    return transcript.filter(isValidTranscriptMessage);
  }

  // If it's a plain object (prevents prototype pollution via 'in' operator)
  if (isPlainObject(transcript)) {
    // Use Object.hasOwn instead of 'in' to avoid prototype chain
    if (Object.hasOwn(transcript, "messages") && Array.isArray(transcript.messages)) {
      return (transcript.messages as unknown[]).filter(isValidTranscriptMessage);
    }
    // Try to extract from Retell format
    if (Object.hasOwn(transcript, "transcript") && typeof transcript.transcript === "string") {
      return parseTextTranscript(transcript.transcript);
    }
  }

  // If it's a string, try to parse it
  if (typeof transcript === "string") {
    // Try JSON parse first
    try {
      const parsed = JSON.parse(transcript);
      // Only recurse for arrays or plain objects to prevent infinite loops
      if (Array.isArray(parsed) || isPlainObject(parsed)) {
        return parseTranscript(parsed);
      }
    } catch {
      // Parse conversational format
      return parseTextTranscript(transcript);
    }
  }

  return [];
}

function ChatMessage({
  message,
  agentName = "Koya",
  isFirst,
  isLast,
}: {
  message: TranscriptMessage;
  agentName?: string;
  isFirst: boolean;
  isLast: boolean;
}) {
  const isAgent = message.role === "agent";

  return (
    <div
      className={cn(
        "flex gap-3",
        isAgent ? "flex-row" : "flex-row-reverse"
      )}
    >
      {/* Avatar */}
      {isFirst && (
        <div
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
            isAgent
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isAgent ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
        </div>
      )}
      {!isFirst && <div className="w-8 shrink-0" />}

      {/* Message bubble */}
      <div
        className={cn(
          "max-w-[80%] space-y-1",
          isAgent ? "items-start" : "items-end"
        )}
      >
        {isFirst && (
          <p className={cn(
            "text-xs font-medium",
            isAgent ? "text-left" : "text-right"
          )}>
            {isAgent ? agentName : "Caller"}
          </p>
        )}
        <div
          className={cn(
            "rounded-2xl px-4 py-2.5 text-sm",
            isAgent
              ? "bg-muted text-foreground rounded-tl-md"
              : "bg-primary text-primary-foreground rounded-tr-md",
            !isFirst && isAgent && "rounded-tl-2xl",
            !isFirst && !isAgent && "rounded-tr-2xl",
            !isLast && isAgent && "rounded-bl-md",
            !isLast && !isAgent && "rounded-br-md"
          )}
        >
          {message.content}
        </div>
        {message.timestamp && isLast && (
          <p className={cn(
            "text-xs text-muted-foreground",
            isAgent ? "text-left" : "text-right"
          )}>
            {typeof message.timestamp === "number"
              ? format(new Date(message.timestamp), "h:mm a")
              : message.timestamp}
          </p>
        )}
      </div>
    </div>
  );
}

export function ChatTranscript({
  transcript,
  agentName = "Koya",
  className,
}: ChatTranscriptProps) {
  const messages = React.useMemo(
    () => parseTranscript(transcript),
    [transcript]
  );

  if (messages.length === 0) {
    return (
      <div className={cn("text-center py-8 text-muted-foreground", className)}>
        <Volume2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">No transcript available</p>
      </div>
    );
  }

  // Group consecutive messages by same role
  const groupedMessages: {
    role: "agent" | "user";
    messages: TranscriptMessage[];
  }[] = [];

  for (const message of messages) {
    const lastGroup = groupedMessages[groupedMessages.length - 1];
    if (lastGroup && lastGroup.role === message.role) {
      lastGroup.messages.push(message);
    } else {
      groupedMessages.push({ role: message.role, messages: [message] });
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      {groupedMessages.map((group, groupIndex) => (
        <div key={groupIndex} className="space-y-1">
          {group.messages.map((message, messageIndex) => (
            <ChatMessage
              key={`${groupIndex}-${messageIndex}`}
              message={message}
              agentName={agentName}
              isFirst={messageIndex === 0}
              isLast={messageIndex === group.messages.length - 1}
            />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Compact version for previews */
export function ChatTranscriptPreview({
  transcript,
  maxMessages = 3,
  className,
}: {
  transcript: string | TranscriptMessage[] | Record<string, unknown>;
  maxMessages?: number;
  className?: string;
}) {
  const messages = React.useMemo(
    () => parseTranscript(transcript).slice(0, maxMessages),
    [transcript, maxMessages]
  );

  if (messages.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-2", className)}>
      {messages.map((message, index) => (
        <div
          key={index}
          className={cn(
            "text-xs px-2 py-1 rounded",
            message.role === "agent"
              ? "bg-muted text-muted-foreground"
              : "bg-primary/10 text-foreground"
          )}
        >
          <span className="font-medium">
            {message.role === "agent" ? "AI: " : "Caller: "}
          </span>
          <span className="line-clamp-1">{message.content}</span>
        </div>
      ))}
    </div>
  );
}
