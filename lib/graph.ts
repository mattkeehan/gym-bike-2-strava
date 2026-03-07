import sharp from 'sharp';

export interface TracePoint {
  x: number;
  y: number | null;
}

export interface CropBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Extract the blue trace from a cropped power graph image
 * Detects pixels where blue is dominant (blue > red + threshold && blue > green + threshold)
 * Returns one representative y coordinate per x column
 */
export async function extractBlueTraceFromCrop(
  imageBuffer: Buffer,
  crop: CropBox
): Promise<TracePoint[]> {
  // Crop and get raw pixel data
  const { data, info } = await sharp(imageBuffer)
    .extract({
      left: Math.round(crop.x),
      top: Math.round(crop.y),
      width: Math.round(crop.width),
      height: Math.round(crop.height),
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;
  const trace: TracePoint[] = [];

  // For each column (x position)
  for (let x = 0; x < width; x++) {
    const blueYPositions: number[] = [];

    // Scan the column from top to bottom
    for (let y = 0; y < height; y++) {
      const offset = (y * width + x) * channels;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];

      // Detect blue pixels (blue significantly higher than red and green)
      const threshold = 30;
      if (b > r + threshold && b > g + threshold && b > 100) {
        blueYPositions.push(y);
      }
    }

    // Find representative y for this column
    let y: number | null = null;
    if (blueYPositions.length > 0) {
      // Use median to avoid outliers
      blueYPositions.sort((a, b) => a - b);
      const mid = Math.floor(blueYPositions.length / 2);
      y = blueYPositions[mid];
    }

    trace.push({ x, y });
  }

  // Interpolate missing values
  return interpolateMissingPoints(trace);
}

/**
 * Fill in null y values by linear interpolation
 */
function interpolateMissingPoints(trace: TracePoint[]): TracePoint[] {
  const result = [...trace];

  for (let i = 0; i < result.length; i++) {
    if (result[i].y === null) {
      // Find previous and next valid points
      let prevIdx = i - 1;
      while (prevIdx >= 0 && result[prevIdx].y === null) prevIdx--;

      let nextIdx = i + 1;
      while (nextIdx < result.length && result[nextIdx].y === null) nextIdx++;

      // Interpolate
      if (prevIdx >= 0 && nextIdx < result.length) {
        const prevY = result[prevIdx].y!;
        const nextY = result[nextIdx].y!;
        const ratio = (i - prevIdx) / (nextIdx - prevIdx);
        result[i].y = prevY + (nextY - prevY) * ratio;
      } else if (prevIdx >= 0) {
        result[i].y = result[prevIdx].y;
      } else if (nextIdx < result.length) {
        result[i].y = result[nextIdx].y;
      }
    }
  }

  return result;
}

/**
 * Apply simple moving average smoothing
 */
export function smoothTrace(trace: TracePoint[], windowSize: number = 5): TracePoint[] {
  const result: TracePoint[] = [];
  const halfWindow = Math.floor(windowSize / 2);

  for (let i = 0; i < trace.length; i++) {
    if (trace[i].y === null) {
      result.push(trace[i]);
      continue;
    }

    let sum = 0;
    let count = 0;

    for (let j = Math.max(0, i - halfWindow); j <= Math.min(trace.length - 1, i + halfWindow); j++) {
      if (trace[j].y !== null) {
        sum += trace[j].y!;
        count++;
      }
    }

    result.push({
      x: trace[i].x,
      y: count > 0 ? sum / count : trace[i].y,
    });
  }

  return result;
}
