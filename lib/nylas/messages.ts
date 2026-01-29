/**
 * Nylas Messages API wrapper
 * List, read, send, and manage emails via connected grant
 */

import { getNylasClient } from "./client";
import { logError } from "@/lib/logging";

export interface NylasMessage {
  id: string;
  subject: string;
  from: Array<{ name: string; email: string }>;
  to: Array<{ name: string; email: string }>;
  cc?: Array<{ name: string; email: string }>;
  bcc?: Array<{ name: string; email: string }>;
  date: number;
  unread: boolean;
  starred: boolean;
  snippet: string;
  body: string;
  threadId: string;
  folders: string[];
  hasAttachments: boolean;
}

export interface NylasFolder {
  id: string;
  name: string;
  systemFolder?: string;
  totalCount?: number;
  unreadCount?: number;
}

/**
 * List messages for a grant
 */
export async function listMessages(
  grantId: string,
  options: {
    limit?: number;
    offset?: number;
    folderId?: string;
    unread?: boolean;
    searchQuery?: string;
  } = {}
): Promise<{ messages: NylasMessage[]; nextCursor?: string }> {
  const nylas = getNylasClient();

  const queryParams: Record<string, unknown> = {
    limit: options.limit || 25,
  };

  if (options.folderId) queryParams.in = options.folderId;
  if (options.unread !== undefined) queryParams.unread = options.unread;
  if (options.searchQuery) queryParams.searchQueryNative = options.searchQuery;
  if (options.offset) queryParams.offset = options.offset;

  const response = await nylas.messages.list({
    identifier: grantId,
    queryParams: queryParams as any,
  });

  const messages: NylasMessage[] = (response.data as any[]).map((m: any) => ({
    id: m.id,
    subject: m.subject || "(no subject)",
    from: m.from || [],
    to: m.to || [],
    cc: m.cc || [],
    bcc: m.bcc || [],
    date: m.date || 0,
    unread: m.unread ?? true,
    starred: m.starred ?? false,
    snippet: m.snippet || "",
    body: m.body || "",
    threadId: m.threadId || "",
    folders: m.folders || [],
    hasAttachments: (m.attachments?.length || 0) > 0,
  }));

  return { messages, nextCursor: (response as any).nextCursor };
}

/**
 * Get a single message by ID
 */
export async function getMessage(
  grantId: string,
  messageId: string
): Promise<NylasMessage> {
  const nylas = getNylasClient();

  const response = await nylas.messages.find({
    identifier: grantId,
    messageId,
  });

  const m = response.data as any;
  return {
    id: m.id,
    subject: m.subject || "(no subject)",
    from: m.from || [],
    to: m.to || [],
    cc: m.cc || [],
    bcc: m.bcc || [],
    date: m.date || 0,
    unread: m.unread ?? true,
    starred: m.starred ?? false,
    snippet: m.snippet || "",
    body: m.body || "",
    threadId: m.threadId || "",
    folders: m.folders || [],
    hasAttachments: (m.attachments?.length || 0) > 0,
  };
}

/**
 * Send a message using direct REST API (SDK has auth issues)
 */
export async function sendMessage(
  grantId: string,
  params: {
    to: Array<{ name?: string; email: string }>;
    cc?: Array<{ name?: string; email: string }>;
    bcc?: Array<{ name?: string; email: string }>;
    subject: string;
    body: string;
    replyToMessageId?: string;
  }
): Promise<{ id: string }> {
  const apiKey = process.env.NYLAS_API_KEY;
  if (!apiKey) {
    throw new Error("NYLAS_API_KEY environment variable is not set");
  }

  const apiUri = (process.env.NYLAS_API_URI || "https://api.us.nylas.com").replace(/\/$/, "");

  const requestBody: any = {
    to: params.to.map((r) => ({ name: r.name || "", email: r.email })),
    subject: params.subject,
    body: params.body,
  };

  if (params.cc?.length) {
    requestBody.cc = params.cc.map((r) => ({ name: r.name || "", email: r.email }));
  }
  if (params.bcc?.length) {
    requestBody.bcc = params.bcc.map((r) => ({ name: r.name || "", email: r.email }));
  }
  if (params.replyToMessageId) {
    requestBody.reply_to_message_id = params.replyToMessageId;
  }

  const response = await fetch(`${apiUri}/v3/grants/${grantId}/messages/send`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.error?.message || `Nylas API error: HTTP ${response.status}`);
  }

  const data = await response.json();
  return { id: data.data?.id || data.id };
}

/**
 * Update message (mark read/unread, starred)
 */
export async function updateMessage(
  grantId: string,
  messageId: string,
  updates: { unread?: boolean; starred?: boolean }
): Promise<void> {
  const nylas = getNylasClient();

  await nylas.messages.update({
    identifier: grantId,
    messageId,
    requestBody: updates as any,
  });
}

/**
 * List folders for a grant
 */
export async function listFolders(grantId: string): Promise<NylasFolder[]> {
  const nylas = getNylasClient();

  try {
    const response = await nylas.folders.list({ identifier: grantId });

    return (response.data as any[]).map((f: any) => ({
      id: f.id,
      name: f.name || f.id,
      systemFolder: f.systemFolder,
      totalCount: f.totalCount,
      unreadCount: f.unreadCount,
    }));
  } catch (err) {
    logError("Nylas Messages", `Failed to list folders: ${err}`);
    return [];
  }
}
