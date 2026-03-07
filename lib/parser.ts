import { WorkoutMetrics } from '../types';

export function parseWorkoutMetrics(text: string): WorkoutMetrics | null {
  try {
    // Extract duration (mm:ss format) - more flexible with spacing
    const durationMatch = text.match(/(\d{1,3}):(\d{2})\s*mins?\s*on\s*(?:the\s*)?bike/i);
    if (!durationMatch) {
      throw new Error('Duration not found in text');
    }
    const minutes = parseInt(durationMatch[1], 10);
    const seconds = parseInt(durationMatch[2], 10);
    const durationSeconds = minutes * 60 + seconds;

    // Find ALL numbers in the text (2-4 digits)
    const allNumbersMatch = Array.from(text.matchAll(/\b(\d{2,4})\b/g));
    const allNumbers = allNumbersMatch.map(m => parseInt(m[1], 10));
    
    // Also try to find numbers that OCR might have split with spaces (e.g., "4 7 4")
    const spaceNumberMatch = Array.from(text.matchAll(/(\d)\s+(\d)\s+(\d)/g));
    const spaceNumbers = spaceNumberMatch.map(m => parseInt(m[1] + m[2] + m[3], 10));
    allNumbers.push(...spaceNumbers);

    // Filter for potential watts values (typically 100-600 for workouts)
    const potentialWatts = allNumbers.filter(n => n >= 100 && n < 1000);
    
    // If we have at least 2 potential watts values, use them
    let maxWatts: number;
    let avgWatts: number;
    
    if (potentialWatts.length >= 2) {
      // Sort descending to get max first
      potentialWatts.sort((a, b) => b - a);
      maxWatts = potentialWatts[0];
      avgWatts = potentialWatts[1];
    } else if (potentialWatts.length === 1) {
      // If only one value found, use it as average and estimate max
      avgWatts = potentialWatts[0];
      maxWatts = Math.round(avgWatts * 2.2); // Rough estimate
    } else {
      throw new Error('Could not find watts values in text');
    }

    // Extract cadence - look for RPM values
    // Clean text for better parsing
    const cleanText = text.replace(/\s+/g, ' ');
    const cadenceMatches = Array.from(cleanText.matchAll(/(\d{2,3})\s*RPM/gi));
    const cadenceNumbers = cadenceMatches.map(m => parseInt(m[1], 10)).filter(n => n > 0 && n < 300);

    let maxCadence: number | undefined;
    let avgCadence: number | undefined;

    if (cadenceNumbers.length >= 2) {
      // First occurrence is usually max, second is average based on screen layout
      maxCadence = cadenceNumbers[0];
      avgCadence = cadenceNumbers[1];
      
      // Handle OCR errors where leading digit might be missing (e.g., "04" instead of "104")
      if (maxCadence < 40 && maxCadence > 0) {
        maxCadence = parseInt('1' + maxCadence.toString().padStart(2, '0'), 10);
      }
      
      // Ensure max is actually larger than average, swap if needed
      if (maxCadence < avgCadence) {
        [maxCadence, avgCadence] = [avgCadence, maxCadence];
      }
    } else if (cadenceNumbers.length === 1) {
      avgCadence = cadenceNumbers[0];
    }

    return {
      durationSeconds,
      avgWatts,
      maxWatts,
      avgCadence,
      maxCadence,
    };
  } catch (error) {
    console.error('Parsing error:', error);
    return null;
  }
}
