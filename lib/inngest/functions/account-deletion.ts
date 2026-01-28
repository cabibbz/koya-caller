/**
 * Koya Caller - Account Deletion Background Jobs
 * GDPR/CCPA Compliance
 *
 * Handles scheduled account deletion after grace period
 */

import { inngest } from "../client";
import {
  getDeletionRequestsPastGracePeriod,
  executePermanentDeletion,
} from "@/lib/db/privacy";
import { logError, logInfo } from "@/lib/logging";

// =============================================================================
// Check Pending Deletions (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to check for deletion requests past their grace period
 * Runs every hour
 */
export const checkPendingDeletions = inngest._base.createFunction(
  {
    id: "privacy-check-pending-deletions",
    name: "Check Pending Account Deletions",
  },
  { cron: "0 * * * *" }, // Every hour
  async ({ step }) => {
    // Fetch all deletion requests past their grace period
    const pendingDeletions = await step.run(
      "fetch-pending-deletions",
      async () => {
        return getDeletionRequestsPastGracePeriod();
      }
    );

    if (pendingDeletions.length === 0) {
      return { checked: 0, deleted: 0 };
    }

    logInfo(
      "Account Deletion",
      `Found ${pendingDeletions.length} accounts ready for deletion`
    );

    let deletedCount = 0;

    // Process each deletion
    for (const request of pendingDeletions) {
      await step.run(`delete-account-${request.id}`, async () => {
        try {
          await executePermanentDeletion(
            request.id,
            request.business_id,
            request.user_id
          );
          deletedCount++;

          logInfo(
            "Account Deletion",
            `Successfully deleted account for business ${request.business_id}`
          );
        } catch (error) {
          logError(
            "Account Deletion",
            `Failed to delete business ${request.business_id}: ${error}`
          );
          // Don't throw - continue with other deletions
        }
      });
    }

    return {
      checked: pendingDeletions.length,
      deleted: deletedCount,
    };
  }
);

// =============================================================================
// Scheduled Deletion Event Handler
// =============================================================================

/**
 * Handle scheduled deletion event
 * This is triggered when a user requests account deletion
 * It uses step.sleepUntil to wait for the grace period to end
 */
export const processScheduledDeletion = inngest._base.createFunction(
  {
    id: "privacy-process-scheduled-deletion",
    name: "Process Scheduled Account Deletion",
    retries: 3,
    // Cancel if the user cancels their deletion request
    cancelOn: [
      {
        event: "privacy/deletion.cancelled",
        match: "data.requestId",
      },
    ],
  },
  { event: "privacy/deletion.scheduled" },
  async ({ event, step }) => {
    const { requestId, businessId, userId, gracePeriodEndsAt } = event.data;

    logInfo(
      "Account Deletion",
      `Scheduled deletion for business ${businessId}, waiting until ${gracePeriodEndsAt}`
    );

    // Wait until the grace period ends
    await step.sleepUntil("wait-for-grace-period", new Date(gracePeriodEndsAt));

    // After grace period, verify the request is still pending
    // (User might have cancelled during the waiting period)
    const { getDataRequestById } = await import("@/lib/db/privacy");

    const request = await step.run("verify-request-status", async () => {
      return getDataRequestById(requestId);
    });

    if (!request) {
      logInfo(
        "Account Deletion",
        `Request ${requestId} not found - may have been cancelled`
      );
      return { success: false, reason: "Request not found" };
    }

    if (request.status !== "pending") {
      logInfo(
        "Account Deletion",
        `Request ${requestId} is no longer pending (status: ${request.status})`
      );
      return { success: false, reason: `Status is ${request.status}` };
    }

    // Execute the deletion
    await step.run("execute-deletion", async () => {
      await executePermanentDeletion(requestId, businessId, userId);
    });

    logInfo(
      "Account Deletion",
      `Successfully deleted account for business ${businessId}`
    );

    return {
      success: true,
      businessId,
      deletedAt: new Date().toISOString(),
    };
  }
);

// =============================================================================
// Deletion Cancelled Event Handler
// =============================================================================

/**
 * Handle deletion cancellation event
 * This is used to track cancellations for analytics
 */
export const processDeletionCancellation = inngest._base.createFunction(
  {
    id: "privacy-process-deletion-cancellation",
    name: "Process Deletion Cancellation",
  },
  { event: "privacy/deletion.cancelled" },
  async ({ event, step }) => {
    const { requestId, businessId } = event.data;

    await step.run("log-cancellation", async () => {
      logInfo(
        "Account Deletion",
        `Deletion cancelled for request ${requestId}, business ${businessId}`
      );
    });

    return {
      success: true,
      requestId,
      businessId,
      cancelledAt: new Date().toISOString(),
    };
  }
);

// =============================================================================
// Cleanup Expired Exports (Scheduled Job)
// =============================================================================

/**
 * Scheduled job to clean up expired export files
 * Runs daily at 3am
 */
export const cleanupExpiredExports = inngest._base.createFunction(
  {
    id: "privacy-cleanup-expired-exports",
    name: "Cleanup Expired Data Exports",
  },
  { cron: "0 3 * * *" }, // Daily at 3am
  async ({ step }) => {
    const { getExpiredExports } = await import("@/lib/db/privacy");
    const { createAdminClient } = await import("@/lib/supabase/admin");

    const expiredExports = await step.run("fetch-expired-exports", async () => {
      return getExpiredExports();
    });

    if (expiredExports.length === 0) {
      return { cleaned: 0 };
    }

    logInfo(
      "Export Cleanup",
      `Found ${expiredExports.length} expired exports to clean up`
    );

    let cleanedCount = 0;

    for (const exportRequest of expiredExports) {
      await step.run(`cleanup-export-${exportRequest.id}`, async () => {
        const supabase = createAdminClient();

        // If using Supabase Storage, delete the file here
        // For now, we just clear the file path reference
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("data_requests")
          .update({
            export_file_path: null,
          })
          .eq("id", exportRequest.id);

        cleanedCount++;
      });
    }

    return {
      cleaned: cleanedCount,
    };
  }
);
