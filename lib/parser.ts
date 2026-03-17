import { WorkoutMetrics } from '../types';

export function parseWorkoutMetrics(text: string): WorkoutMetrics | null {
  try {
    // Extract duration (mm:ss format) - very flexible for OCR errors
    // Matches patterns like "41:37 mins on the bike", "41:37 mins on the bi", "41:37 mins on the hike"
    const durationMatch = text.match(/(\d{1,3}):(\d{2})\s*mins?\s*on\s*(?:the\s*)?(?:bike?|hike?|bi)/i);
    if (!durationMatch) {
      throw new Error('Duration not found in text');
    }
    const minutes = parseInt(durationMatch[1], 10);
    const seconds = parseInt(durationMatch[2], 10);
    const durationSeconds = minutes * 60 + seconds;

    // Strategy 1: Look for numbers near contextual keywords
    const lines = text.split('\n');
    let maxWatts: number | undefined;
    let avgWatts: number | undefined;
    let maxCadence: number | undefined;
    let avgCadence: number | undefined;

    // Parse each line looking for CADENCE, WATTS, RPM, MAXIMUM, AVERAGE keywords
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const upperLine = line.toUpperCase();
      
      // Extract all numbers from this line (including those with letters attached like "A114")
      const numbersInLine = Array.from(line.matchAll(/[A-Z]?(\d{2,3})(?:\s*[A-Z]{2,})?/gi))
        .map(m => parseInt(m[1], 10))
        .filter(n => !isNaN(n));
      
      // CADENCE + RPM context
      if (upperLine.includes('CADENCE') || upperLine.includes('RPM')) {
        const rpmNumbers = numbersInLine.filter(n => n >= 40 && n <= 200);
        
        if (upperLine.includes('MAXIMUM') || upperLine.includes('MAX')) {
          if (rpmNumbers[0]) maxCadence = rpmNumbers[0];
        } else if (upperLine.includes('AVERAGE') || upperLine.includes('AVG')) {
          if (rpmNumbers[0]) avgCadence = rpmNumbers[0];
        } else if (rpmNumbers.length >= 2) {
          // Line has multiple RPM values - first is max, second is avg
          [maxCadence, avgCadence] = rpmNumbers;
        } else if (rpmNumbers.length === 1 && !maxCadence) {
          maxCadence = rpmNumbers[0];
        } else if (rpmNumbers.length === 1 && !avgCadence) {
          avgCadence = rpmNumbers[0];
        }
      }
      
      // WATTS context
      if (upperLine.includes('WATTS') || upperLine.includes('WATT')) {
        const wattsNumbers = numbersInLine.filter(n => n >= 100 && n <= 800);
        
        if (upperLine.includes('MAXIMUM') || upperLine.includes('MAX')) {
          if (wattsNumbers[0]) maxWatts = wattsNumbers[0];
        } else if (upperLine.includes('AVERAGE') || upperLine.includes('AVG')) {
          if (wattsNumbers[0]) avgWatts = wattsNumbers[0];
        } else if (wattsNumbers.length >= 2) {
          // Line has multiple watts values - first is max, second is avg
          [maxWatts, avgWatts] = wattsNumbers;
        } else if (wattsNumbers.length === 1 && !maxWatts) {
          maxWatts = wattsNumbers[0];
        } else if (wattsNumbers.length === 1 && !avgWatts) {
          avgWatts = wattsNumbers[0];
        }
      }
    }

    // Strategy 2: Fallback to finding all numbers if Strategy 1 didn't work
    if (!maxWatts || !avgWatts) {
      const allNumbersMatch = Array.from(text.matchAll(/\b(\d{2,4})\b/g));
      const allNumbers = allNumbersMatch.map(m => parseInt(m[1], 10));
      
      // Also try to find numbers that OCR might have split with spaces (e.g., "4 1 4")
      const spaceNumberMatch = Array.from(text.matchAll(/(\d)\s+(\d)\s+(\d)/g));
      const spaceNumbers = spaceNumberMatch.map(m => parseInt(m[1] + m[2] + m[3], 10));
      allNumbers.push(...spaceNumbers);

      // Filter for potential watts values (typically 100-600 for workouts)
      const potentialWatts = allNumbers.filter(n => n >= 100 && n < 1000);
      
      if (potentialWatts.length >= 2) {
        // Sort descending to get max first
        potentialWatts.sort((a, b) => b - a);
        maxWatts = maxWatts || potentialWatts[0];
        avgWatts = avgWatts || potentialWatts[1];
      } else if (potentialWatts.length === 1) {
        avgWatts = avgWatts || potentialWatts[0];
        maxWatts = maxWatts || Math.round(avgWatts * 2.2);
      }
    }

    if (!maxWatts || !avgWatts) {
      throw new Error('Could not find watts values in text');
    }

    // Ensure max > avg for both watts and cadence
    if (maxWatts < avgWatts) {
      [maxWatts, avgWatts] = [avgWatts, maxWatts];
    }
    
    if (maxCadence && avgCadence && maxCadence < avgCadence) {
      [maxCadence, avgCadence] = [avgCadence, maxCadence];
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
