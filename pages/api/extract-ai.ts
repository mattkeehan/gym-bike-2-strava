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

const NormalizedTraceSchema = z
  .array(z.number().min(0).max(1))
  .length(60)
  .nullable();

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

  // New graph-related fields
  powerGraphVisible: z.boolean().nullable(),
  cadenceGraphVisible: z.boolean().nullable(),
  graphPointCount: z.number().nullable(),
  powerSeries: NormalizedTraceSchema,
  cadenceSeries: NormalizedTraceSchema,
});

export type WorkoutExtraction = z.infer<typeof WorkoutExtractionSchema>;

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
              text: `
You are extracting FINAL workout summary values from a gym machine photo.

Return values only through the provided schema.

This may be a gym bike or treadmill summary screen.
Your job is to extract the final visible workout summary metrics and, if visible, approximate the small summary charts.

GENERAL RULES
- Extract only clearly visible FINAL summary values.
- If a value is not visible, return null.
- Do not guess or hallucinate.
- Ignore branding, decorative UI, buttons, instructions, and unrelated numbers.
- Prefer correctness over completeness.
- If uncertain, return null.

MACHINE TYPE
- "bike" if you see cycling metrics such as watts, power, rpm, cadence.
- "treadmill" if you see pace, incline, speed, distance in running context.
- "unknown" only if the machine type cannot be determined.

METRICS
- durationText: raw visible duration string if present, e.g. "41:35"
- durationSeconds: convert visible duration to total seconds
- avgWatts / maxWatts: bike only
- avgCadence / maxCadence: bike cadence/rpm, or treadmill cadence if explicitly shown
- distanceKm: convert to kilometers if needed
- avgPace: keep as visible string if shown
- incline: treadmill incline percentage if shown
- confidence: number from 0 to 1 representing overall confidence
- notes: brief notes about glare, ambiguity, conversion, or chart visibility

CHART EXTRACTION
Some bike screens include small line charts on the right, especially:
- cadence chart
- watts/power chart
- sometimes heart-rate chart

If a cadence and/or watts chart is visible, estimate its SHAPE only.

For each visible chart:
- Return exactly 60 evenly spaced normalized points from left to right
- Each point must be between 0 and 1
- 0 means bottom of chart area
- 1 means top of chart area
- Capture overall shape: steady sections, surges, dips, spikes
- Preserve obvious major dips/spikes
- Prefer a believable smooth approximation over noisy detail
- Do NOT try to infer exact watts/rpm from the chart itself
- Do NOT fabricate detail if the chart is too unclear
- If a chart is not visible enough, return null for that series

GRAPH FIELDS
- powerGraphVisible: true if a watts/power chart is visible enough to assess
- cadenceGraphVisible: true if a cadence/rpm chart is visible enough to assess
- graphPointCount: 60 if returning trace arrays, otherwise null
- powerSeries: 60 normalized points or null
- cadenceSeries: 60 normalized points or null

IMPORTANT
- Ignore heart-rate chart if it is flat/zero or not useful
- The normalized traces are approximate shapes only
- Use null rather than guessing
- Return only schema-compatible structured output
              `.trim(),
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