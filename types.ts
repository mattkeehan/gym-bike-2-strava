export interface WorkoutMetrics {
  durationSeconds: number;
  avgWatts: number;
  maxWatts: number;
  avgCadence?: number;
  maxCadence?: number;
  powerSeries?: PowerSample[]; // Inferred power over time
}

export interface PowerSample {
  time: number; // seconds from start
  watts: number;
}
