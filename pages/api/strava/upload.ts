import { NextApiRequest, NextApiResponse } from 'next';
import { getValidStravaTokens } from '../../../lib/strava-auth';
import { uploadToStrava } from '../../../lib/strava-api';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '5mb',
    },
  },
};

/**
 * Upload TCX file to Strava
 * POST /api/strava/upload
 * Body: { tcxContent: string, name?: string, description?: string }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tcxContent, name, description } = req.body;

    if (!tcxContent || typeof tcxContent !== 'string') {
      return res.status(400).json({ error: 'Missing or invalid tcxContent' });
    }

    // Get valid tokens (will refresh if needed)
    const tokens = await getValidStravaTokens();

    if (!tokens) {
      return res.status(401).json({ 
        error: 'Not connected to Strava',
        code: 'NOT_CONNECTED',
      });
    }

    // Upload to Strava
    console.log('Uploading workout to Strava...');
    const uploadResult = await uploadToStrava(
      tokens.access_token,
      tcxContent,
      name,
      description
    );

    console.log('Upload initiated:', uploadResult);

    return res.status(200).json({
      success: true,
      upload: uploadResult,
    });

  } catch (error: any) {
    console.error('Upload error:', error);
    
    return res.status(500).json({ 
      error: error.message || 'Failed to upload to Strava',
      code: 'UPLOAD_FAILED',
    });
  }
}
