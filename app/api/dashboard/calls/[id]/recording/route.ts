/**
 * Recording Proxy API Route
 *
 * Proxies recording audio to avoid CORS issues.
 * Includes HIPAA compliance features:
 * - PHI audit logging for all recording access
 * - Justification requirement when HIPAA mode is enabled
 * - Short-lived signed URLs for secure access
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withAuth,
  success,
  errors,
  type BusinessAuthContext,
} from "@/lib/api/auth-middleware";
import { getClientIp } from "@/lib/security";
import { checkHIPAAEnabled, getComplianceSettings } from "@/lib/hipaa";
import { auditRecordingAccess } from "@/lib/hipaa/audit";
import {
  verifySignedRecordingUrl,
  getSecureRecordingUrl,
} from "@/lib/hipaa/encryption";
import { logError } from "@/lib/logging";

export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ id: string }>;
};

async function handleGet(
  request: NextRequest,
  { business, supabase, user }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id: callId } = await context.params;

    // Check for signed URL parameters (for secure access)
    const url = new URL(request.url);
    const signature = url.searchParams.get("sig");
    const expiry = url.searchParams.get("exp");
    const signedUserId = url.searchParams.get("uid");

    // If signed URL parameters are present, verify them
    if (signature && expiry && signedUserId) {
      // Verify the signature
      const isValid = verifySignedRecordingUrl(callId, signature, expiry, signedUserId);
      if (!isValid) {
        return errors.forbidden("Invalid or expired recording URL");
      }

      // Verify user ID matches
      if (signedUserId !== user.id) {
        return errors.forbidden("Recording URL was not issued to this user");
      }
    }

    // Check HIPAA mode status
    const hipaaEnabled = await checkHIPAAEnabled(business.id);
    let settings = null;

    if (hipaaEnabled) {
      settings = await getComplianceSettings(business.id);

      // In HIPAA mode, require justification for recording access
      if (settings?.require_phi_justification) {
        const justification = request.headers.get("x-phi-justification");

        if (!justification && !signature) {
          // If not using a signed URL and no justification provided, return secure URL info
          const secureUrl = await getSecureRecordingUrl(callId, user.id, {
            ipAddress: getClientIp(request) || undefined,
            userAgent: request.headers.get("user-agent") || undefined,
          });

          if (!secureUrl) {
            return errors.internalError("Failed to generate secure URL");
          }

          return NextResponse.json(
            {
              error: "PHI justification required",
              code: "PHI_JUSTIFICATION_REQUIRED",
              message:
                "HIPAA mode requires a justification for accessing recordings. Provide a justification header or use the secure URL.",
              secureUrl: {
                url: secureUrl.url,
                expiresAt: secureUrl.expiresAt,
              },
            },
            { status: 403 }
          );
        }

        // Log the access with justification
        await auditRecordingAccess(callId, user.id, "play", {
          businessId: business.id,
          justification: justification || "Accessed via signed URL",
          ipAddress: getClientIp(request) || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        });
      } else {
        // HIPAA enabled but justification not required - still log access
        await auditRecordingAccess(callId, user.id, "play", {
          businessId: business.id,
          ipAddress: getClientIp(request) || undefined,
          userAgent: request.headers.get("user-agent") || undefined,
        });
      }
    }

    // Get the call and verify ownership
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: call, error: callError } = await (supabase as any)
      .from("calls")
      .select("recording_url, phi_detected, phi_categories")
      .eq("id", callId)
      .eq("business_id", business.id)
      .single();

    if (callError || !call) {
      return errors.notFound("Call");
    }

    const recordingUrl = call?.recording_url as string | null;
    if (!recordingUrl) {
      return errors.notFound("No recording available");
    }

    // Add PHI warning headers if PHI was detected
    const headers: Record<string, string> = {
      "Content-Type": "audio/wav",
      "Cache-Control": hipaaEnabled
        ? "no-store, no-cache, must-revalidate"
        : "private, max-age=3600",
    };

    if (call.phi_detected) {
      headers["X-PHI-Warning"] = "true";
      headers["X-PHI-Categories"] = (call.phi_categories || []).join(",");
    }

    // Fetch the recording
    const response = await fetch(recordingUrl);
    if (!response.ok) {
      return errors.internalError("Failed to fetch recording");
    }

    const audioBuffer = await response.arrayBuffer();
    headers["Content-Length"] = audioBuffer.byteLength.toString();

    // Return with proper audio headers
    return new NextResponse(audioBuffer, { headers });
  } catch (error) {
    logError("Recording Proxy", error);
    return errors.internalError("Failed to proxy recording");
  }
}

/**
 * Generate a secure signed URL for recording access
 * This endpoint returns a time-limited URL that can be used to access the recording
 */
async function handlePost(
  request: NextRequest,
  { business, supabase, user }: BusinessAuthContext,
  context?: RouteContext
) {
  try {
    if (!context) {
      return errors.badRequest("Invalid request");
    }
    const { id: callId } = await context.params;

    // Verify call belongs to business
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase RLS type inference
    const { data: call, error: callError } = await (supabase as any)
      .from("calls")
      .select("id, recording_url")
      .eq("id", callId)
      .eq("business_id", business.id)
      .single();

    if (callError || !call) {
      return errors.notFound("Call");
    }

    if (!call.recording_url) {
      return errors.notFound("No recording available");
    }

    // Parse request body for justification
    let justification: string | undefined;
    let expirySeconds: number | undefined;

    try {
      const body = await request.json();
      justification = body.justification;
      expirySeconds = body.expirySeconds;
    } catch {
      // Body might be empty
    }

    // Generate secure URL
    const secureUrl = await getSecureRecordingUrl(callId, user.id, {
      justification,
      expirySeconds,
      ipAddress: getClientIp(request) || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });

    if (!secureUrl) {
      return errors.internalError("Failed to generate secure URL");
    }

    return success({
      url: secureUrl.url,
      expiresAt: secureUrl.expiresAt,
      callId: secureUrl.callId,
    });
  } catch (error) {
    logError("Secure URL Generation", error);
    return errors.internalError("Failed to generate secure URL");
  }
}

// Apply auth middleware - cast needed for route context support
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const GET = withAuth(handleGet as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const POST = withAuth(handlePost as any);
