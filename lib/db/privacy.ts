/**
 * Privacy Database Helpers - GDPR/CCPA Compliance
 * Handles data export and deletion requests
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { } from "@supabase/supabase-js";
import { logError } from "@/lib/logging";

// ============================================
// Types
// ============================================

export type DataRequestType = "export" | "deletion";
export type DataRequestStatus = "pending" | "processing" | "completed" | "cancelled";

export interface DataRequest {
  id: string;
  user_id: string;
  business_id: string;
  request_type: DataRequestType;
  status: DataRequestStatus;
  grace_period_ends_at: string | null;
  processed_at: string | null;
  feedback_reason: string | null;
  export_file_path: string | null;
  export_expires_at: string | null;
  created_at: string;
}

export interface DataRequestInsert {
  user_id: string;
  business_id: string;
  request_type: DataRequestType;
  status?: DataRequestStatus;
  grace_period_ends_at?: string;
  feedback_reason?: string;
}

export interface DataRequestUpdate {
  status?: DataRequestStatus;
  processed_at?: string;
  export_file_path?: string;
  export_expires_at?: string;
}

export interface BusinessExportData {
  exported_at: string;
  business: Record<string, unknown>;
  business_hours: Record<string, unknown>[];
  services: Record<string, unknown>[];
  faqs: Record<string, unknown>[];
  knowledge: Record<string, unknown> | null;
  ai_config: Record<string, unknown> | null;
  call_settings: Record<string, unknown> | null;
  calendar_integration: Record<string, unknown> | null;
  availability_slots: Record<string, unknown>[];
  phone_numbers: Record<string, unknown>[];
  calls: Record<string, unknown>[];
  appointments: Record<string, unknown>[];
  sms_messages: Record<string, unknown>[];
  notification_settings: Record<string, unknown> | null;
}

// ============================================
// Data Request CRUD Operations
// ============================================

/**
 * Get all data requests for a user
 */
export async function getDataRequestsByUserId(
  userId: string
): Promise<DataRequest[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as DataRequest[];
}

/**
 * Get a specific data request by ID
 */
export async function getDataRequestById(
  id: string
): Promise<DataRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as DataRequest | null;
}

/**
 * Get pending deletion request for a business
 */
export async function getPendingDeletionRequest(
  businessId: string
): Promise<DataRequest | null> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("data_requests")
    .select("*")
    .eq("business_id", businessId)
    .eq("request_type", "deletion")
    .eq("status", "pending")
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as DataRequest | null;
}

/**
 * Create a new data request
 */
export async function createDataRequest(
  request: DataRequestInsert
): Promise<DataRequest> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("data_requests")
    .insert(request)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to create data request");
  return data as DataRequest;
}

/**
 * Update a data request
 */
export async function updateDataRequest(
  id: string,
  updates: DataRequestUpdate
): Promise<DataRequest> {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("data_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update data request");
  return data as DataRequest;
}

/**
 * Update a data request using admin client (for background jobs)
 */
export async function updateDataRequestAdmin(
  id: string,
  updates: DataRequestUpdate
): Promise<DataRequest> {
  const supabase = createAdminClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("data_requests")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  if (!data) throw new Error("Failed to update data request");
  return data as DataRequest;
}

/**
 * Cancel a pending deletion request
 */
export async function cancelDeletionRequest(
  id: string
): Promise<DataRequest> {
  return updateDataRequest(id, {
    status: "cancelled",
  });
}

// ============================================
// Data Export Functions
// ============================================

/**
 * Get all business data for export using the database function
 */
export async function getBusinessExportData(
  businessId: string
): Promise<BusinessExportData> {
  const supabase = createAdminClient();

  // Use the database function to get all data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any).rpc(
    "get_business_export_data",
    { p_business_id: businessId }
  );

  if (error) throw error;
  if (!data) throw new Error("Failed to export business data");

  return data as BusinessExportData;
}

/**
 * Create an export request and generate the export
 */
export async function createExportRequest(
  userId: string,
  businessId: string
): Promise<DataRequest> {
  // Check for existing pending export request
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("data_requests")
    .select("*")
    .eq("business_id", businessId)
    .eq("request_type", "export")
    .in("status", ["pending", "processing"])
    .single();

  if (existing) {
    return existing as DataRequest;
  }

  // Create new export request
  const request = await createDataRequest({
    user_id: userId,
    business_id: businessId,
    request_type: "export",
    status: "processing",
  });

  return request;
}

// ============================================
// Data Deletion Functions
// ============================================

/**
 * Calculate grace period end date (14 days from now)
 */
export function calculateGracePeriodEnd(): string {
  const gracePeriodDays = 14;
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + gracePeriodDays);
  return endDate.toISOString();
}

/**
 * Create a deletion request with 14-day grace period
 */
export async function createDeletionRequest(
  userId: string,
  businessId: string,
  feedbackReason?: string
): Promise<DataRequest> {
  // Check for existing pending deletion request
  const existing = await getPendingDeletionRequest(businessId);
  if (existing) {
    throw new Error("A deletion request is already pending for this account");
  }

  const gracePeriodEndsAt = calculateGracePeriodEnd();

  // Create the deletion request
  const request = await createDataRequest({
    user_id: userId,
    business_id: businessId,
    request_type: "deletion",
    status: "pending",
    grace_period_ends_at: gracePeriodEndsAt,
    feedback_reason: feedbackReason,
  });

  // Mark business as scheduled for deletion
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("businesses")
    .update({
      deleted_at: new Date().toISOString(),
      deletion_scheduled_at: gracePeriodEndsAt,
    })
    .eq("id", businessId);

  return request;
}

/**
 * Cancel a deletion request and restore the business
 */
export async function cancelDeletionAndRestore(
  requestId: string,
  businessId: string
): Promise<DataRequest> {
  // Cancel the request
  const request = await cancelDeletionRequest(requestId);

  // Restore the business
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("businesses")
    .update({
      deleted_at: null,
      deletion_scheduled_at: null,
    })
    .eq("id", businessId);

  return request;
}

/**
 * Execute permanent deletion (called by Inngest after grace period)
 * This uses admin client as it runs in background without user session
 */
export async function executePermanentDeletion(
  requestId: string,
  businessId: string,
  userId: string
): Promise<void> {
  const supabase = createAdminClient();

  // Update request status to processing
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase as any)
    .from("data_requests")
    .update({ status: "processing" })
    .eq("id", requestId);

  try {
    // Call the database function to delete all business data
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: deleteError } = await (supabase as any).rpc(
      "delete_business_data",
      { p_business_id: businessId }
    );

    if (deleteError) throw deleteError;

    // Delete the user from auth.users via Supabase Admin API
    const { error: userDeleteError } = await supabase.auth.admin.deleteUser(
      userId
    );

    if (userDeleteError) {
      // Log but don't fail - business data is already deleted
      logError("Delete Auth User", userDeleteError);
    }

    // The data_requests record will be deleted with the business cascade
    // But we update it first for audit purposes (in case cascade fails)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("data_requests")
      .update({
        status: "completed",
        processed_at: new Date().toISOString(),
      })
      .eq("id", requestId);
  } catch (error) {
    // Update request with failure status
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase as any)
      .from("data_requests")
      .update({
        status: "pending", // Reset to pending so it can be retried
      })
      .eq("id", requestId);

    throw error;
  }
}

// ============================================
// Query Functions for Background Jobs
// ============================================

/**
 * Get deletion requests that have passed their grace period
 * Used by the scheduled Inngest job
 */
export async function getDeletionRequestsPastGracePeriod(): Promise<DataRequest[]> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("data_requests")
    .select("*")
    .eq("request_type", "deletion")
    .eq("status", "pending")
    .lt("grace_period_ends_at", now);

  if (error) throw error;
  return (data ?? []) as DataRequest[];
}

/**
 * Get expired export files for cleanup
 * Used by a cleanup job to remove old exports
 */
export async function getExpiredExports(): Promise<DataRequest[]> {
  const supabase = createAdminClient();
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("data_requests")
    .select("*")
    .eq("request_type", "export")
    .eq("status", "completed")
    .lt("export_expires_at", now)
    .not("export_file_path", "is", null);

  if (error) throw error;
  return (data ?? []) as DataRequest[];
}
