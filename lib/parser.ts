import { WorkoutMetrics, WorkoutType } from '../types';

export function parseWorkoutMetrics(text: string): WorkoutMetrics | null {
  try {
    // First, detect workout type
    const workoutType = detectWorkoutType(text);
    
    if (workoutType === 'run') {
      return parseRunWorkout(text);
    } else {
      return parseBikeWorkout(text);
    }
  } catch (error) {
    console.error('Parsing error:', error);
    return null;
  }
}

function detectWorkoutType(text: string): WorkoutType {
  const upperText = text.toUpperCase();
  
  // Look for running/treadmill indicators
  if (upperText.includes('PACE') || 
      upperText.includes('TREADMILL') || 
      upperText.includes('RUNNING') ||
      upperText.includes('MIN/KM') ||
      upperText.includes('MIN/MI')) {
    return 'run';
  }
  
  // Look for bike indicators
  if (upperText.includes('BIKE') || 
      upperText.includes('WATTS') || 
      upperText.includes('RPM')) {
    return 'bike';
  }
  
  // Default to bike
  return 'bike';
}

function parseRunWorkout(text: string): WorkoutMetrics | null {
  // Extract duration - be very flexible with format
  // Look for any pattern like XX:XX that could be duration
  const allTimePatterns = Array.from(text.matchAll(/(\d{1,3}):(\d{2})/g));
  
  if (allTimePatterns.length === 0) {
    throw new Error('Duration not found in text');
  }
  
  // The longest time value is likely the duration (45:09 is longer than 10:55)
  let durationMatch = allTimePatterns[0];
  for (const match of allTimePatterns) {
    const mins = parseInt(match[1], 10);
    const currentDuration = mins * 60 + parseInt(match[2], 10);
    const prevDuration = parseInt(durationMatch[1], 10) * 60 + parseInt(durationMatch[2], 10);
    if (currentDuration > prevDuration) {
      durationMatch = match;
    }
  }
  
  const minutes = parseInt(durationMatch[1], 10);
  const seconds = parseInt(durationMatch[2], 10);
  const durationSeconds = minutes * 60 + seconds;

  // Extract pace - look for remaining time patterns (should be shorter than duration)
  let avgPaceSeconds: number | undefined;
  for (const match of allTimePatterns) {
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const timeValue = mins * 60 + secs;
    
    // Pace is typically 3-20 minutes per km, duration should be longer
    if (timeValue < durationSeconds && mins >= 3 && mins <= 20) {
      avgPaceSeconds = timeValue;
      break;
    }
  }

  // Extract calories - look for 2-4 digit numbers (not part of time)
  let calories: number | undefined;
  const lines = text.split('\n');
  for (const line of lines) {
    const upperLine = line.toUpperCase();
    if (upperLine.includes('CALOR') || upperLine.includes('KCAL') || upperLine.includes('CAL')) {
      // Find numbers in this line
      const numbers = Array.from(line.matchAll(/\b(\d{2,4})\b/g))
        .map(m => parseInt(m[1], 10))
        .filter(n => n >= 50 && n <= 9999); // Reasonable calorie range
      
      if (numbers.length > 0) {
        calories = numbers[0];
        break;
      }
    }
  }
  
  // If we didn't find calories with context, look for any 3-digit number
  if (!calories) {
    const allNumbers = Array.from(text.matchAll(/\b(\d{3})\b/g))
      .map(m => parseInt(m[1], 10))
      .filter(n => n >= 100 && n <= 999);
    if (allNumbers.length > 0) {
      calories = allNumbers[0];
    }
  }

  // Calculate distance from duration and pace if we have pace
  let distanceKm: number | undefined;
  if (avgPaceSeconds && avgPaceSeconds > 0) {
    // distance (km) = duration (seconds) / pace (seconds per km)
    distanceKm = durationSeconds / avgPaceSeconds;
  }

  return {
    type: 'run',
    durationSeconds,
    avgPaceSeconds,
    distanceKm,
    calories,
  };
}

function parseBikeWorkout(text: string): WorkoutMetrics | null {
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
    type: 'bike',
    durationSeconds,
    avgWatts,
    maxWatts,
    avgCadence,
    maxCadence,
  };
}
