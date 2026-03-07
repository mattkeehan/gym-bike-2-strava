import { TracePoint } from './graph';

export interface PowerSample {
  time: number; // seconds from start
  watts: number;
}

/**
 * Convert a trace from graph extraction to a power series
 * @param trace Array of {x, y} points from the graph (y increases downward)
 * @param durationSeconds Total workout duration in seconds
 * @param avgWatts Known average watts
 * @param maxWatts Known maximum watts
 * @returns Power samples at approximately 1Hz
 */
export function traceToPowerSeries(
  trace: TracePoint[],
  durationSeconds: number,
  avgWatts: number,
  maxWatts: number
): PowerSample[] {
  if (trace.length === 0) return [];

  // Find the min and max y values in the trace (y increases downward in images)
  const yValues = trace.map(p => p.y).filter((y): y is number => y !== null);
  if (yValues.length === 0) return [];

  const minY = Math.min(...yValues); // top of graph = max watts
  const maxY = Math.max(...yValues); // bottom of graph = min watts
  const yRange = maxY - minY;

  // Map each trace point to time and watts
  const rawSamples: PowerSample[] = trace.map((point, index) => {
    // Convert x position to time
    const time = (index / (trace.length - 1)) * durationSeconds;

    // Convert y position to watts (inverted: lower y = higher watts)
    let watts: number;
    if (point.y === null || yRange === 0) {
      watts = avgWatts;
    } else {
      // Normalize y to 0-1 range (0 = top = max, 1 = bottom = min)
      const normalized = (point.y - minY) / yRange;
      // Invert so 0 = max, 1 = min, and scale to watts range
      // Assume graph goes from 0 to maxWatts
      watts = maxWatts * (1 - normalized);
    }

    return { time, watts: Math.max(0, watts) };
  });

  // Resample to approximately 1 sample per second
  const samples = resampleToOneHz(rawSamples, durationSeconds);

  // Scale to match known avg and max
  const scaled = scaleToTargetStats(samples, avgWatts, maxWatts);

  return scaled;
}

/**
 * Resample power series to approximately 1 sample per second
 */
function resampleToOneHz(samples: PowerSample[], durationSeconds: number): PowerSample[] {
  const result: PowerSample[] = [];
  const targetCount = Math.ceil(durationSeconds);

  for (let i = 0; i < targetCount; i++) {
    const targetTime = i;

    // Find the sample closest to this time
    let closestIdx = 0;
    let closestDist = Infinity;

    for (let j = 0; j < samples.length; j++) {
      const dist = Math.abs(samples[j].time - targetTime);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = j;
      }
    }

    // Interpolate between neighbors if possible
    let watts: number;
    if (closestIdx > 0 && closestIdx < samples.length - 1) {
      const before = samples[closestIdx - 1];
      const after = samples[closestIdx + 1];
      const t = (targetTime - before.time) / (after.time - before.time);
      watts = before.watts + (after.watts - before.watts) * t;
    } else {
      watts = samples[closestIdx].watts;
    }

    result.push({ time: targetTime, watts: Math.max(0, Math.round(watts)) });
  }

  return result;
}

/**
 * Scale the power series to match target average and maximum
 */
function scaleToTargetStats(
  samples: PowerSample[],
  targetAvg: number,
  targetMax: number
): PowerSample[] {
  if (samples.length === 0) return samples;

  // Calculate current stats
  const currentMax = Math.max(...samples.map(s => s.watts));
  const currentAvg = samples.reduce((sum, s) => sum + s.watts, 0) / samples.length;

  if (currentMax === 0 || currentAvg === 0) return samples;

  // Scale to match max first
  const maxScale = targetMax / currentMax;
  let scaled = samples.map(s => ({
    time: s.time,
    watts: s.watts * maxScale,
  }));

  // Check if average needs adjustment
  const scaledAvg = scaled.reduce((sum, s) => sum + s.watts, 0) / scaled.length;
  const avgOffset = targetAvg - scaledAvg;

  // Apply offset to bring average closer to target (but preserve relative shape)
  if (Math.abs(avgOffset) > 5) {
    scaled = scaled.map(s => ({
      time: s.time,
      watts: Math.max(0, Math.round(s.watts + avgOffset)),
    }));
  }

  // Clamp any values that exceeded max after offset
  const finalMax = Math.max(...scaled.map(s => s.watts));
  if (finalMax > targetMax) {
    const clampScale = targetMax / finalMax;
    scaled = scaled.map(s => ({
      time: s.time,
      watts: Math.round(s.watts * clampScale),
    }));
  }

  return scaled;
}
