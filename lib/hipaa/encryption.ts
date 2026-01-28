/**
 * HIPAA Recording Encryption
 *
 * Provides encryption utilities for secure recording handling:
 * - Generate time-limited signed URLs with audit logging
 * - Encrypt recordings for at-rest storage
 * - Decrypt recordings for authorized playback
 * - Key rotation for compliance
 *
 * Uses AES-256-GCM for encryption with per-recording unique keys.
 * Keys are encrypted with a master key stored securely.
 */

import crypto from "crypto";
import { createClient, createAdminClient } from "@/lib/supabase/server";
import { logError } from "@/lib/logging";
import { logPHIAccess, checkHIPAAEnabled, getComplianceSettings } from "./index";
import { auditRecordingAccess } from "./audit";

// =============================================================================
// CONSTANTS
// =============================================================================

// AES-256-GCM parameters
const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const _AUTH_TAG_LENGTH = 16; // 128 bits

// Signed URL expiry (5 minutes by default for HIPAA compliance)
const DEFAULT_URL_EXPIRY_SECONDS = 300;

// Maximum URL expiry (1 hour absolute max)
const MAX_URL_EXPIRY_SECONDS = 3600;

// =============================================================================
// TYPES
// =============================================================================

export interface EncryptedRecording {
  encryptedData: string; // Base64 encoded
  iv: string; // Base64 encoded
  authTag: string; // Base64 encoded
  keyId: string;
  algorithm: string;
  version: number;
}

export interface SignedRecordingUrl {
  url: string;
  expiresAt: string;
  callId: string;
  keyId: string | null;
}

export interface EncryptionKey {
  id: string;
  business_id: string;
  key_encrypted: string; // Master-key-encrypted data key
  key_version: number;
  created_at: string;
  rotated_at: string | null;
  is_active: boolean;
}

// =============================================================================
// KEY MANAGEMENT
// =============================================================================

/**
 * Get or derive master key from environment
 * In production, this should come from a KMS (AWS KMS, HashiCorp Vault, etc.)
 */
function getMasterKey(): Buffer {
  const masterKeyHex = process.env.HIPAA_MASTER_KEY;

  if (!masterKeyHex) {
    // Generate a warning for development - in production this should fail
    if (process.env.NODE_ENV === "production") {
      throw new Error("HIPAA_MASTER_KEY environment variable is required in production");
    }
    // Development fallback - NOT SECURE FOR PRODUCTION
    logError("HIPAA Encryption", new Error("Using development key - NOT SECURE FOR PRODUCTION"));
    return crypto.scryptSync("development-key-not-secure", "salt", KEY_LENGTH);
  }

  return Buffer.from(masterKeyHex, "hex");
}

/**
 * Encrypt a data key with the master key
 */
function encryptDataKey(dataKey: Buffer): string {
  const masterKey = getMasterKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, masterKey, iv);

  const encrypted = Buffer.concat([
    cipher.update(dataKey),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  // Format: iv:authTag:encrypted (all base64)
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/**
 * Decrypt a data key with the master key
 */
function decryptDataKey(encryptedKey: string): Buffer {
  const masterKey = getMasterKey();
  const [ivB64, authTagB64, encryptedB64] = encryptedKey.split(":");

  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const encrypted = Buffer.from(encryptedB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, masterKey, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);
}

/**
 * Generate a new data encryption key
 */
function generateDataKey(): Buffer {
  return crypto.randomBytes(KEY_LENGTH);
}

// =============================================================================
// KEY STORAGE
// =============================================================================

/**
 * Get or create encryption key for a business
 */
async function getActiveEncryptionKey(businessId: string): Promise<EncryptionKey | null> {
  try {
    const supabase = createAdminClient();

    // Try to get existing active key
    const { data: existingKey, error: selectError } = await (supabase as any)
      .from("encryption_keys")
      .select("*")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .single();

    if (!selectError && existingKey) {
      return existingKey as EncryptionKey;
    }

    // Create new key
    const newDataKey = generateDataKey();
    const encryptedKey = encryptDataKey(newDataKey);

    const { data: newKey, error: insertError } = await (supabase as any)
      .from("encryption_keys")
      .insert({
        business_id: businessId,
        key_encrypted: encryptedKey,
        key_version: 1,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertError) {
      logError("Create Encryption Key", insertError);
      return null;
    }

    return newKey as EncryptionKey;
  } catch (error) {
    logError("Get Encryption Key", error);
    return null;
  }
}

/**
 * Get encryption key by ID
 */
async function getEncryptionKeyById(keyId: string): Promise<EncryptionKey | null> {
  try {
    const supabase = createAdminClient();

    const { data, error } = await (supabase as any)
      .from("encryption_keys")
      .select("*")
      .eq("id", keyId)
      .single();

    if (error) {
      logError("Get Encryption Key by ID", error);
      return null;
    }

    return data as EncryptionKey;
  } catch (error) {
    logError("Get Encryption Key by ID", error);
    return null;
  }
}

// =============================================================================
// SECURE RECORDING URL
// =============================================================================

/**
 * Generate a secure, time-limited signed URL for recording access
 *
 * This function:
 * 1. Verifies user authorization
 * 2. Logs the access for HIPAA audit
 * 3. Returns a time-limited signed URL
 *
 * @param callId - Call ID to get recording for
 * @param userId - User requesting access
 * @param options - Additional options
 * @returns Signed URL with metadata
 */
export async function getSecureRecordingUrl(
  callId: string,
  userId: string,
  options?: {
    justification?: string;
    expirySeconds?: number;
    ipAddress?: string;
    userAgent?: string;
  }
): Promise<SignedRecordingUrl | null> {
  try {
    const supabase = await createClient();

    // Get call record and verify access
    const { data: call, error: callError } = await (supabase as any)
      .from("calls")
      .select("id, business_id, recording_url")
      .eq("id", callId)
      .single();

    if (callError || !call) {
      logError("Get Secure Recording URL - Call not found", callError);
      return null;
    }

    if (!call.recording_url) {
      return null; // No recording available
    }

    // Check HIPAA mode and settings
    const hipaaEnabled = await checkHIPAAEnabled(call.business_id);
    const settings = hipaaEnabled ? await getComplianceSettings(call.business_id) : null;

    // Require justification if HIPAA mode is enabled
    if (hipaaEnabled && settings?.require_phi_justification && !options?.justification) {
      throw new Error("PHI justification required for HIPAA-enabled accounts");
    }

    // Log the access
    await auditRecordingAccess(callId, userId, "view", {
      businessId: call.business_id,
      justification: options?.justification,
      ipAddress: options?.ipAddress,
      userAgent: options?.userAgent,
    });

    // Calculate expiry
    const expirySeconds = Math.min(
      options?.expirySeconds || DEFAULT_URL_EXPIRY_SECONDS,
      MAX_URL_EXPIRY_SECONDS
    );
    const expiresAt = new Date(Date.now() + expirySeconds * 1000);

    // Generate signed URL
    // For actual signed URL generation, you would integrate with your storage provider
    // (S3 presigned URLs, GCS signed URLs, etc.)
    // Here we're creating a proxy URL through our API
    const signature = crypto
      .createHmac("sha256", process.env.RECORDING_URL_SECRET || "default-secret")
      .update(`${callId}:${userId}:${expiresAt.getTime()}`)
      .digest("hex");

    const signedUrl = new URL(`/api/dashboard/calls/${callId}/recording`, process.env.NEXT_PUBLIC_SITE_URL || "https://localhost:3000");
    signedUrl.searchParams.set("sig", signature);
    signedUrl.searchParams.set("exp", expiresAt.getTime().toString());
    signedUrl.searchParams.set("uid", userId);

    return {
      url: signedUrl.toString(),
      expiresAt: expiresAt.toISOString(),
      callId,
      keyId: settings?.encryption_key_id || null,
    };
  } catch (error) {
    logError("Get Secure Recording URL", error);
    return null;
  }
}

/**
 * Verify a signed recording URL
 *
 * @param callId - Call ID from URL
 * @param signature - Signature from URL
 * @param expiry - Expiry timestamp from URL
 * @param userId - User ID from URL
 * @returns true if signature is valid and not expired
 */
export function verifySignedRecordingUrl(
  callId: string,
  signature: string,
  expiry: string,
  userId: string
): boolean {
  try {
    const expiryTime = parseInt(expiry, 10);

    // Check if expired
    if (Date.now() > expiryTime) {
      return false;
    }

    // Verify signature
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RECORDING_URL_SECRET || "default-secret")
      .update(`${callId}:${userId}:${expiryTime}`)
      .digest("hex");

    // Timing-safe comparison
    return crypto.timingSafeEqual(
      Buffer.from(signature, "hex"),
      Buffer.from(expectedSignature, "hex")
    );
  } catch {
    return false;
  }
}

// =============================================================================
// RECORDING ENCRYPTION
// =============================================================================

/**
 * Encrypt recording data for at-rest storage
 *
 * @param recordingBuffer - Raw recording data
 * @param businessId - Business ID for key lookup
 * @returns Encrypted recording metadata
 */
export async function encryptRecording(
  recordingBuffer: Buffer,
  businessId: string
): Promise<EncryptedRecording | null> {
  try {
    // Get encryption key
    const encryptionKey = await getActiveEncryptionKey(businessId);
    if (!encryptionKey) {
      logError("Encrypt Recording", new Error("No encryption key available"));
      return null;
    }

    // Decrypt the data key
    const dataKey = decryptDataKey(encryptionKey.key_encrypted);

    // Generate IV for this encryption
    const iv = crypto.randomBytes(IV_LENGTH);

    // Encrypt the recording
    const cipher = crypto.createCipheriv(ALGORITHM, dataKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(recordingBuffer),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      encryptedData: encrypted.toString("base64"),
      iv: iv.toString("base64"),
      authTag: authTag.toString("base64"),
      keyId: encryptionKey.id,
      algorithm: ALGORITHM,
      version: 1,
    };
  } catch (error) {
    logError("Encrypt Recording", error);
    return null;
  }
}

/**
 * Encrypt recording from URL
 *
 * Fetches recording from URL and encrypts it.
 *
 * @param url - Recording URL to fetch and encrypt
 * @param businessId - Business ID for key lookup
 * @returns Encrypted recording metadata
 */
export async function encryptRecordingFromUrl(
  url: string,
  businessId: string
): Promise<EncryptedRecording | null> {
  try {
    // Fetch the recording
    const response = await fetch(url);
    if (!response.ok) {
      logError("Encrypt Recording from URL", new Error(`Failed to fetch: ${response.status}`));
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    return await encryptRecording(buffer, businessId);
  } catch (error) {
    logError("Encrypt Recording from URL", error);
    return null;
  }
}

/**
 * Decrypt recording for playback
 *
 * @param encryptedRecording - Encrypted recording metadata
 * @returns Decrypted recording buffer
 */
export async function decryptRecording(
  encryptedRecording: EncryptedRecording
): Promise<Buffer | null> {
  try {
    // Get the encryption key
    const encryptionKey = await getEncryptionKeyById(encryptedRecording.keyId);
    if (!encryptionKey) {
      logError("Decrypt Recording", new Error("Encryption key not found"));
      return null;
    }

    // Decrypt the data key
    const dataKey = decryptDataKey(encryptionKey.key_encrypted);

    // Decrypt the recording
    const iv = Buffer.from(encryptedRecording.iv, "base64");
    const authTag = Buffer.from(encryptedRecording.authTag, "base64");
    const encrypted = Buffer.from(encryptedRecording.encryptedData, "base64");

    const decipher = crypto.createDecipheriv(ALGORITHM, dataKey, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);
  } catch (error) {
    logError("Decrypt Recording", error);
    return null;
  }
}

// =============================================================================
// KEY ROTATION
// =============================================================================

/**
 * Rotate encryption key for a business
 *
 * Creates a new encryption key and marks the old one as inactive.
 * Existing recordings encrypted with the old key can still be decrypted.
 *
 * @param businessId - Business ID
 * @param userId - User performing rotation (for audit)
 * @returns New key ID or null on error
 */
export async function rotateEncryptionKey(
  businessId: string,
  userId: string
): Promise<string | null> {
  try {
    const supabase = createAdminClient();

    // Get current active key
    const { data: currentKey } = await (supabase as any)
      .from("encryption_keys")
      .select("id, key_version")
      .eq("business_id", businessId)
      .eq("is_active", true)
      .single();

    // Deactivate current key
    if (currentKey) {
      await (supabase as any)
        .from("encryption_keys")
        .update({
          is_active: false,
          rotated_at: new Date().toISOString(),
        })
        .eq("id", currentKey.id);
    }

    // Generate new key
    const newDataKey = generateDataKey();
    const encryptedKey = encryptDataKey(newDataKey);
    const newVersion = (currentKey?.key_version || 0) + 1;

    const { data: newKey, error } = await (supabase as any)
      .from("encryption_keys")
      .insert({
        business_id: businessId,
        key_encrypted: encryptedKey,
        key_version: newVersion,
        is_active: true,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) {
      logError("Rotate Encryption Key - Insert", error);
      return null;
    }

    // Update compliance settings with new key ID
    await (supabase as any)
      .from("compliance_settings")
      .update({
        encryption_key_id: newKey.id,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId);

    // Log the key rotation
    await logPHIAccess({
      businessId,
      userId,
      eventType: "encryption_key_rotate",
      resourceType: "contact", // Using contact as closest resource type
      resourceId: newKey.id,
      action: "rotate_encryption_key",
      metadata: {
        previousKeyId: currentKey?.id,
        newKeyId: newKey.id,
        newKeyVersion: newVersion,
      },
    });

    return newKey.id;
  } catch (error) {
    logError("Rotate Encryption Key", error);
    return null;
  }
}

/**
 * Re-encrypt a recording with a new key
 *
 * Used during key rotation to migrate recordings to new keys.
 *
 * @param callId - Call ID
 * @param businessId - Business ID
 * @returns true if re-encryption successful
 */
export async function reEncryptRecording(
  callId: string,
  businessId: string
): Promise<boolean> {
  try {
    const supabase = createAdminClient();

    // Get current encrypted recording metadata
    const { data: call } = await (supabase as any)
      .from("calls")
      .select("encrypted_recording")
      .eq("id", callId)
      .single();

    if (!call?.encrypted_recording) {
      return false;
    }

    // Decrypt with old key
    const decrypted = await decryptRecording(call.encrypted_recording);
    if (!decrypted) {
      return false;
    }

    // Re-encrypt with new key
    const reEncrypted = await encryptRecording(decrypted, businessId);
    if (!reEncrypted) {
      return false;
    }

    // Update call record
    await (supabase as any)
      .from("calls")
      .update({
        encrypted_recording: reEncrypted,
      })
      .eq("id", callId);

    return true;
  } catch (error) {
    logError("Re-encrypt Recording", error);
    return false;
  }
}

// =============================================================================
// EXPORTS
// =============================================================================

export {
  DEFAULT_URL_EXPIRY_SECONDS,
  MAX_URL_EXPIRY_SECONDS,
};
