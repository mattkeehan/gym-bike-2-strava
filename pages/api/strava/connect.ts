import { NextApiRequest, NextApiResponse } from 'next';

/**
 * Initiate Strava OAuth flow
 * Redirects user to Strava authorization page
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  const redirectUri = process.env.STRAVA_REDIRECT_URI;

  if (!clientId) {
    return res.status(500).json({ error: 'STRAVA_CLIENT_ID not configured' });
  }

  if (!redirectUri) {
    return res.status(500).json({ error: 'STRAVA_REDIRECT_URI not configured' });
  }

  // Build Strava OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    approval_prompt: 'force', // Force consent screen to ensure fresh scope grant
    scope: 'activity:write', // Request write access for uploading activities
  });

  const authUrl = `https://www.strava.com/oauth/authorize?${params.toString()}`;

  console.log('=== STRAVA CONNECT ===');
  console.log('Client ID:', clientId);
  console.log('Redirect URI:', redirectUri);
  console.log('Requested scope:', 'activity:write');
  console.log('Full auth URL:', authUrl);
  console.log('=====================');

  // Redirect to Strava
  res.redirect(authUrl);
}
