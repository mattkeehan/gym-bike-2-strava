import { NextApiRequest, NextApiResponse } from 'next';
import { getValidStravaTokens } from '../../../lib/strava-auth';
import { checkUploadStatus } from '../../../lib/strava-api';

/**
 * Check Strava upload status
 * GET /api/strava/upload-status?uploadId=123456
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { uploadId } = req.query;

    if (!uploadId || typeof uploadId !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid uploadId' });
    }

    // Parse uploadId to number
    const uploadIdNum = parseInt(uploadId, 10);
    if (isNaN(uploadIdNum)) {
      return res.status(400).json({ error: 'Invalid uploadId format' });
    }

    // Get valid tokens
    const tokens = await getValidStravaTokens();

    if (!tokens) {
      return res.status(401).json({ 
        error: 'Not connected to Strava',
        code: 'NOT_CONNECTED',
      });
    }

    // Check status
    const status = await checkUploadStatus(tokens.access_token, uploadIdNum);

    return res.status(200).json({
      success: true,
      status,
    });

  } catch (error: any) {
    console.error('Status check error:', error);
    
    return res.status(500).json({ 
      error: error.message || 'Failed to check upload status',
      code: 'STATUS_CHECK_FAILED',
    });
  }
}
