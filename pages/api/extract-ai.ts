import { NextApiRequest, NextApiResponse } from 'next';
import { generateObject } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';

// Increase body size limit for base64 images
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

// Define the strict Zod schema for workout extraction
const WorkoutExtractionSchema = z.object({
  machineType: z.enum(['bike', 'treadmill', 'unknown']).describe('Type of gym machine detected'),
  durationText: z.string().nullable().describe('Duration as shown on screen (e.g., "30:00")'),
  durationSeconds: z.number().nullable().describe('Duration converted to total seconds'),
  avgWatts: z.number().nullable().describe('Average power in watts (bike only)'),
  maxWatts: z.number().nullable().describe('Maximum power in watts (bike only)'),
  avgCadence: z.number().nullable().describe('Average cadence in RPM (bike) or SPM (treadmill)'),
  maxCadence: z.number().nullable().describe('Maximum cadence in RPM (bike) or SPM (treadmill)'),
  distanceKm: z.number().nullable().describe('Distance in kilometers'),
  avgPace: z.string().nullable().describe('Average pace (e.g., "5:30/km" for treadmill)'),
  incline: z.number().nullable().describe('Incline percentage (treadmill only)'),
  confidence: z.number().min(0).max(1).nullable().describe('Confidence score 0-1 for extraction quality'),
  notes: z.string().nullable().describe('Any additional observations or warnings'),
});

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;

    if (!imageBase64) {
      return res.status(400).json({ error: 'Missing imageBase64 in request body' });
    }

    // Validate API key is configured
    const apiKey = process.env.AI_GATEWAY_API_KEY;
    if (!apiKey) {
      console.error('AI_GATEWAY_API_KEY not configured');
      return res.status(500).json({ error: 'AI service not configured' });
    }

    // Initialize OpenAI provider with Vercel AI Gateway
    // For Vercel AI Gateway, set baseURL to the gateway endpoint
    // Example: https://gateway.vercel.com/v1
    const baseURL = process.env.AI_GATEWAY_BASE_URL || 'https://gateway.vercel.com/v1';
    
    const openai = createOpenAI({
      apiKey,
      baseURL,
    });

    // Prepare the image data
    let base64Data: string;
    if (imageBase64.startsWith('data:')) {
      // Extract base64 content after the comma
      base64Data = imageBase64.split(',')[1];
    } else {
      base64Data = imageBase64;
    }

    // Convert to buffer for AI SDK
    const imageBuffer = Buffer.from(base64Data, 'base64');

    // Call AI to extract workout metrics
    const result = await generateObject({
      model: openai('gpt-4o-mini'),
      schema: WorkoutExtractionSchema,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are a specialized OCR system for extracting FINAL workout summary metrics from gym machine display screens.

TASK:
Extract the completed workout summary values from this photo of a gym machine screen (bike or treadmill).

MACHINE TYPE DETECTION:
- "bike" if you see: Watts, Power, RPM (cadence), or typical cycling metrics
- "treadmill" if you see: Pace (min/km or min/mile), Incline, Speed (km/h or mph)
- "unknown" only if the screen is completely unreadable or shows no recognizable workout metrics

CRITICAL RULES:
1. Extract ONLY the final workout summary values, NOT:
   - Current/live values during a workout
   - Target values or workout settings
   - Branding, logos, or machine model names
   - Decorative UI elements or labels
   - Unrelated numbers (serial numbers, firmware versions, etc.)

2. Handle difficult photos:
   - Work through glare, reflections, and poor lighting
   - Ignore visual noise and focus on numerical workout metrics
   - If a number is partially obscured but context makes it clear, extract it
   - If genuinely unreadable or ambiguous, return null

3. Units and conversions:
   - Duration: Convert "30:00", "30:45", "1:15:30" to total seconds
   - Distance: Always convert to kilometers (if in miles, convert: 1 mile = 1.60934 km)
   - Watts: Extract as-is (bike power)
   - Cadence: RPM for bike, SPM (steps per minute) for treadmill
   - Pace: Keep as string with format "M:SS" or "MM:SS" (e.g., "5:30", "10:45")
   - Incline: Extract as percentage (e.g., 5 for 5%)

4. DO NOT hallucinate or guess:
   - If a metric is not visible on screen, return null
   - Do not estimate or calculate missing values
   - Do not assume typical values
   - Uncertainty = null

5. Common gym machine summary metrics to look for:
   - Bike: Duration (time/TIME), Avg Watt/Power, Max Watt/Power, Avg RPM/CAD, Max RPM/CAD, Distance
   - Treadmill: Duration (time/TIME), Distance (dist/DISTANCE), Avg Pace (PACE), Calories (cal/KCAL), Incline (%)

6. Confidence score:
   - 0.9-1.0: All key values clearly visible and readable
   - 0.7-0.9: Most values readable, minor glare or blur
   - 0.5-0.7: Some values hard to read, significant image quality issues
   - 0.3-0.5: Poor quality, only partial data extractable
   - 0.0-0.3: Nearly unreadable, high uncertainty

7. Notes field usage:
   - Mention if glare/reflection affected specific metrics
   - Note unit conversions performed (e.g., "converted miles to km")
   - Flag if workout appears incomplete or in-progress
   - Keep brief and relevant to extraction quality

EXAMPLES OF WHAT TO IGNORE:
- Brand names: "Technogym", "Life Fitness", "Peloton", "NordicTrack"
- UI labels: "Workout Summary", "Results", "Stats", "Zone", "Level"
- Instructions: "Press START", "Cool Down", "Select Workout"
- Non-summary numbers: heart rate zones, current speed, target watts

Extract only the numbers associated with final workout summary metrics.`,
            },
            {
              type: 'image',
              image: imageBuffer,
            },
          ],
        },
      ],
    });

    // Return the extracted workout data
    return res.status(200).json(result.object);

  } catch (error) {
    console.error('AI extraction error:', error);
    
    // Provide more specific error info if available
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return res.status(500).json({ 
      error: 'Failed to extract workout data',
      details: errorMessage,
    });
  }
}
