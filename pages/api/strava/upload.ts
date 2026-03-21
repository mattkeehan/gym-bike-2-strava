import { NextApiRequest, NextApiResponse } from 'next';
import { getValidStravaTokens } from '../../../lib/strava-auth';
import { uploadToStrava, checkUploadStatus, uploadPhotoToActivity } from '../../../lib/strava-api';

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
 * Body: { tcxContent: string, name?: string, description?: string, photo?: string (base64) }
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { tcxContent, name, description, photo } = req.body;

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

    // If photo is provided, wait for activity to be processed and attach photo
    if (photo && uploadResult.id) {
      console.log('Photo provided, waiting for activity to be processed...');
      
      // Poll for activity status (max 30 seconds)
      let activityId: number | null = null;
      const maxAttempts = 15;
      const pollInterval = 2000; // 2 seconds
      
      for (let i = 0; i < maxAttempts; i++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        const status = await checkUploadStatus(tokens.access_token, uploadResult.id);
        console.log(`Upload status (attempt ${i + 1}):`, status);
        
        if (status.activity_id) {
          activityId = status.activity_id;
          break;
        }
        
        if (status.error) {
          console.error('Upload error:', status.error);
          break;
        }
      }
      
      // If we have an activity ID, upload the photo
      if (activityId) {
        console.log('Uploading photo to activity:', activityId);
        try {
          await uploadPhotoToActivity(tokens.access_token, activityId, photo);
          console.log('Photo uploaded successfully');
        } catch (photoError: any) {
          console.error('Failed to upload photo:', photoError);
          // Don't fail the whole upload if photo fails
        }
      } else {
        console.log('Could not get activity ID to attach photo');
      }
    }

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
