export type WorkoutType = 'bike' | 'run';

export interface WorkoutMetrics {
  type: WorkoutType;
  durationSeconds: number;
  
  // Bike-specific metrics
  avgWatts?: number;
  maxWatts?: number;
  avgCadence?: number; // RPM for bike, SPM for run
  maxCadence?: number;
  powerSeries?: PowerSample[];
  
  // Run-specific metrics
  avgPaceSeconds?: number; // seconds per km
  distanceKm?: number;
  calories?: number;
}

export interface PowerSample {
  time: number; // seconds from start
  watts: number;
}
