import { NextApiRequest, NextApiResponse } from 'next';
import { saveStravaTokens, hasRequiredScopes, getStoredStravaTokens } from '../../../lib/strava-auth';

/**
 * Handle Strava OAuth callback
 * Exchange authorization code for access/refresh tokens
 * Also supports ?check=true to check connection status
 * 
 * IMPORTANT: Strava returns the granted scope in the callback URL query params.
 * We must read it from there, NOT from the token exchange response.
 * The token exchange response may not include the scope field.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const { code, error, scope, check } = req.query;
  
  // Check connection status (for client-side polling)
  if (check === 'true') {
    const tokens = await getStoredStravaTokens();
    return res.status(200).json({ connected: !!tokens });
  }

  // User denied authorization
  if (error) {
    console.error('Strava authorization error:', error);
    return res.redirect('/?strava=error&message=authorization_denied');
  }

  // No code provided
  if (!code || typeof code !== 'string') {
    return res.redirect('/?strava=error&message=missing_code');
  }
  
  // Scope is required - Strava returns it as a query param
  // Handle scope as string or string[] (Next.js query parsing)
  const scopeParam = Array.isArray(scope) ? scope[0] : scope;
  if (!scopeParam || typeof scopeParam !== 'string') {
    console.error('Missing scope in callback query params');
    return res.redirect('/?strava=error&message=missing_scope');
  }
  
  console.log('Strava callback - Raw scope from query:', scopeParam);

  // Parse granted scopes from callback query param
  // Strava returns comma-separated scope list
  const grantedScopes = scopeParam.split(',').map(s => s.trim()).filter(Boolean);
  console.log('Parsed granted scopes:', grantedScopes);
  
  // Verify we got activity:write scope
  if (!hasRequiredScopes(grantedScopes, ['activity:write'])) {
    console.error('Missing required scope: activity:write. Granted:', scopeParam);
    return res.redirect('/?strava=error&message=missing_scope');
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    console.error('Missing STRAVA_CLIENT_ID or STRAVA_CLIENT_SECRET');
    return res.redirect('/?strava=error&message=server_config');
  }

  try {
    // Exchange code for tokens
    // Use correct Strava API v3 token endpoint
    const tokenResponse = await fetch('https://www.strava.com/api/v3/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code: code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Token exchange failed:', tokenResponse.status, errorText);
      return res.redirect('/?strava=error&message=token_exchange_failed');
    }

    const tokenData = await tokenResponse.json();
    console.log('Token exchange successful. Expires at:', tokenData.expires_at);

    // Save tokens with scope from callback query (not token response)
    // The token response may not include scope, but we already validated it above
    await saveStravaTokens({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_at: tokenData.expires_at,
      athlete_id: tokenData.athlete?.id?.toString(),
      scope: scopeParam, // Use original callback scope string
    });

    console.log('Strava connected successfully for athlete:', tokenData.athlete?.id);

    // Redirect back to app with success
    return res.redirect('/?strava=connected');
  } catch (error) {
    console.error('Error in Strava callback:', error);
    return res.redirect('/?strava=error&message=unknown');
  }
}
