import fs from 'fs/promises';
import path from 'path';

export interface StravaTokens {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp in seconds
  athlete_id?: string;
  scope?: string;
}

// MVP: File-based storage
// TODO: Replace with database when scaling to multi-user
const TOKENS_FILE_PATH = path.join(process.cwd(), '.strava-tokens.json');

/**
 * Get stored Strava tokens from file system
 * For MVP single-user storage. Replace with DB query for multi-user.
 */
export async function getStoredStravaTokens(): Promise<StravaTokens | null> {
  try {
    const data = await fs.readFile(TOKENS_FILE_PATH, 'utf-8');
    return JSON.parse(data) as StravaTokens;
  } catch (error) {
    // File doesn't exist or can't be read
    return null;
  }
}

/**
 * Save Strava tokens to file system
 * For MVP single-user storage. Replace with DB insert/update for multi-user.
 */
export async function saveStravaTokens(tokens: StravaTokens): Promise<void> {
  await fs.writeFile(TOKENS_FILE_PATH, JSON.stringify(tokens, null, 2), 'utf-8');
}

/**
 * Check if stored tokens exist and are valid
 */
export async function hasValidStravaConnection(): Promise<boolean> {
  const tokens = await getStoredStravaTokens();
  if (!tokens) return false;
  
  // Check if we have required scope
  if (!hasRequiredScopes(tokens.scope?.split(',') || [], ['activity:write'])) {
    return false;
  }
  
  return true;
}

/**
 * Refresh Strava access token if expired or close to expiry
 * @param tokens Current tokens
 * @param bufferSeconds Refresh if expiring within this many seconds (default 300 = 5 minutes)
 * @returns Updated tokens if refreshed, original if still valid, null if refresh failed
 */
export async function refreshStravaTokenIfNeeded(
  tokens: StravaTokens,
  bufferSeconds: number = 300
): Promise<StravaTokens | null> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  const expiresWithBuffer = tokens.expires_at - bufferSeconds;

  // Token is still valid
  if (nowSeconds < expiresWithBuffer) {
    return tokens;
  }

  // Token needs refresh
  console.log('Refreshing Strava access token...');

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET');
    return null;
  }

  try {
    // Use correct Strava API v3 token endpoint
    const response = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: tokens.refresh_token,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('Failed to refresh Strava token:', response.status, error);
      return null;
    }

    const data = await response.json();

    // Preserve original scope from stored tokens
    // Refresh response may not include scope field
    const refreshedTokens: StravaTokens = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: data.expires_at,
      athlete_id: tokens.athlete_id,
      scope: tokens.scope, // Keep original scope
    };

    // Save refreshed tokens
    await saveStravaTokens(refreshedTokens);

    console.log('Strava token refreshed successfully');
    return refreshedTokens;
  } catch (error) {
    console.error('Error refreshing Strava token:', error);
    return null;
  }
}

/**
 * Check if granted scopes include all required scopes
 */
export function hasRequiredScopes(granted: string[], required: string[]): boolean {
  const grantedSet = new Set(granted.map(s => s.trim().toLowerCase()));
  return required.every(scope => grantedSet.has(scope.toLowerCase()));
}

/**
 * Get valid Strava tokens, refreshing if needed
 * Convenience function that combines get + refresh
 */
export async function getValidStravaTokens(): Promise<StravaTokens | null> {
  const tokens = await getStoredStravaTokens();
  if (!tokens) return null;

  return await refreshStravaTokenIfNeeded(tokens);
}
