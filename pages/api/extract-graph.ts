import { NextApiRequest, NextApiResponse } from 'next';
import { extractBlueTraceFromCrop, smoothTrace } from '../../lib/graph';
import { traceToPowerSeries } from '../../lib/power';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, crop, durationSeconds, avgWatts, maxWatts } = req.body;

    if (!imageBase64 || !crop || !durationSeconds || !avgWatts || !maxWatts) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    // Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64.split(',')[1], 'base64');

    // Extract trace from cropped region
    const rawTrace = await extractBlueTraceFromCrop(imageBuffer, crop);

    // Smooth the trace
    const smoothedTrace = smoothTrace(rawTrace, 5);

    // Convert to power series
    const powerSeries = traceToPowerSeries(
      smoothedTrace,
      durationSeconds,
      avgWatts,
      maxWatts
    );

    return res.status(200).json({ powerSeries });
  } catch (error) {
    console.error('Graph extraction error:', error);
    return res.status(500).json({ error: 'Failed to extract power trace' });
  }
}
