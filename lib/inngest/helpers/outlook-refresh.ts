/**
 * Koya Caller - Outlook/Microsoft Token Refresh Helper
 * Session 21: Background Jobs
 * Spec Reference: Part 14, Lines 1750-1756
 */

interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Refresh a Microsoft OAuth access token
 */
export async function refreshOutlookToken(
  refreshToken: string
): Promise<RefreshResult> {
  const clientId = process.env.AZURE_CLIENT_ID;
  const clientSecret = process.env.AZURE_CLIENT_SECRET;
  const tenantId = process.env.AZURE_TENANT_ID || "common";

  if (!clientId || !clientSecret) {
    throw new Error("Microsoft OAuth credentials not configured");
  }

  const tokenUrl = `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
      scope: "offline_access Calendars.ReadWrite User.Read",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Check for specific error types
    if (
      errorData.error === "invalid_grant" ||
      errorData.error_description?.includes("expired")
    ) {
      throw new Error("Microsoft refresh token is invalid or expired");
    }

    throw new Error(
      `Microsoft token refresh failed: ${errorData.error_description || response.statusText}`
    );
  }

  const data = await response.json();

  // Calculate expiration time (Microsoft tokens expire in 1 hour)
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // Microsoft always returns new refresh token
    expiresAt,
  };
}
