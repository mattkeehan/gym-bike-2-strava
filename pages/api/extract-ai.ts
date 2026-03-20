import { NextApiRequest, NextApiResponse } from 'next';
import { generateObject } from 'ai';
import { z } from 'zod';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

const WorkoutExtractionSchema = z.object({
  machineType: z.enum(['bike', 'treadmill', 'unknown']),
  durationText: z.string().nullable(),
  durationSeconds: z.number().nullable(),
  avgWatts: z.number().nullable(),
  maxWatts: z.number().nullable(),
  avgCadence: z.number().nullable(),
  maxCadence: z.number().nullable(),
  distanceKm: z.number().nullable(),
  avgPace: z.string().nullable(),
  incline: z.number().nullable(),
  confidence: z.number().min(0).max(1).nullable(),
  notes: z.string().nullable(),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!process.env.AI_GATEWAY_API_KEY) {
    return res.status(500).json({
      error: 'Missing AI_GATEWAY_API_KEY',
    });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body ?? {};

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    const base64Data = imageBase64.startsWith('data:')
      ? imageBase64.split(',')[1]
      : imageBase64;

    if (!base64Data) {
      return res.status(400).json({ error: 'Invalid imageBase64 payload' });
    }

    const result = await generateObject({
      model: 'openai/gpt-4o-mini',
      schema: WorkoutExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are extracting FINAL workout summary values from a gym machine photo.

Return only structured values through the schema.

Rules:
- This is a gym bike or treadmill summary screen.
- Extract only clearly visible final workout metrics.
- If a value is not visible, return null.
- Do not guess or hallucinate.
- Ignore branding, UI chrome, instructions, and unrelated numbers.
- Convert duration to total seconds if visible.
- Convert distance to kilometers if needed.
- confidence should be between 0 and 1.
- notes should be brief and mention glare, ambiguity, or conversions.`,
            },
            {
              type: 'image',
              image: `data:${mimeType};base64,${base64Data}`,
            },
          ],
        },
      ],
    });

    return res.status(200).json(result.object);
  } catch (error) {
    console.error('AI extraction error:', error);

    const message = error instanceof Error ? error.message : 'Unknown error';

    return res.status(500).json({
      error: 'Failed to extract workout data',
      details: message,
    });
  }
}