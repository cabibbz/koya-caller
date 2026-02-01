/**
 * Koya Caller - Google Token Refresh Helper
 * Session 21: Background Jobs
 * Spec Reference: Part 13, Lines 1667-1704
 */

interface RefreshResult {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
}

/**
 * Refresh a Google OAuth access token
 */
export async function refreshGoogleToken(
  refreshToken: string
): Promise<RefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("Google OAuth credentials not configured");
  }

  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));

    // Check for specific error types
    if (errorData.error === "invalid_grant") {
      throw new Error("Google refresh token is invalid or revoked");
    }

    throw new Error(
      `Google token refresh failed: ${errorData.error_description || response.statusText}`
    );
  }

  const data = await response.json();

  // Calculate expiration time (Google tokens expire in 1 hour)
  const expiresAt = new Date(Date.now() + (data.expires_in || 3600) * 1000);

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token, // May be undefined if not rotated
    expiresAt,
  };
}
