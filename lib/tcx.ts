import { WorkoutMetrics } from '../types';

export function generateTCX(metrics: WorkoutMetrics): string {
  const now = new Date();
  const startTime = new Date(now.getTime() - metrics.durationSeconds * 1000);
  
  let trackpoints = '';
  
  // Use inferred power series if available, otherwise generate synthetic data
  if (metrics.powerSeries && metrics.powerSeries.length > 0) {
    // Use the actual inferred power data
    for (const sample of metrics.powerSeries) {
      const pointTime = new Date(startTime.getTime() + sample.time * 1000).toISOString();
      
      // Estimate cadence based on power (rough correlation)
      let cadence: number | undefined;
      if (metrics.avgCadence && metrics.maxCadence) {
        const powerRatio = sample.watts / metrics.maxWatts;
        cadence = Math.round(
          metrics.avgCadence + (metrics.maxCadence - metrics.avgCadence) * powerRatio * 0.7
        );
      } else if (metrics.avgCadence) {
        cadence = metrics.avgCadence;
      }
      
      trackpoints += `
          <Trackpoint>
            <Time>${pointTime}</Time>
            ${cadence ? `<Cadence>${cadence}</Cadence>` : ''}
            <Extensions>
              <ns3:TPX>
                <ns3:Watts>${sample.watts}</ns3:Watts>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>`;
    }
  } else {
    // Generate synthetic trackpoints every 10 seconds
    const trackpointInterval = 10; // seconds
    const numTrackpoints = Math.floor(metrics.durationSeconds / trackpointInterval);
    
    for (let i = 0; i <= numTrackpoints; i++) {
      const timeOffset = i * trackpointInterval;
      const pointTime = new Date(startTime.getTime() + timeOffset * 1000).toISOString();
      
      // Vary power throughout workout - create realistic variation
      const progressRatio = i / numTrackpoints;
      let watts: number;
      let cadence: number | undefined;
      
      if (progressRatio < 0.1) {
        watts = Math.round(metrics.avgWatts * 0.7);
        cadence = metrics.avgCadence ? Math.round(metrics.avgCadence * 0.8) : undefined;
      } else if (progressRatio >= 0.2 && progressRatio <= 0.3) {
        watts = Math.round(metrics.avgWatts + (metrics.maxWatts - metrics.avgWatts) * (Math.random() * 0.5 + 0.5));
        cadence = metrics.maxCadence ? Math.round(metrics.maxCadence * (Math.random() * 0.2 + 0.8)) : metrics.avgCadence;
      } else if (progressRatio > 0.9) {
        watts = Math.round(metrics.avgWatts * 0.8);
        cadence = metrics.avgCadence ? Math.round(metrics.avgCadence * 0.85) : undefined;
      } else {
        watts = Math.round(metrics.avgWatts + (Math.random() - 0.5) * metrics.avgWatts * 0.3);
        cadence = metrics.avgCadence ? Math.round(metrics.avgCadence + (Math.random() - 0.5) * 15) : undefined;
      }
      
      if (i === Math.floor(numTrackpoints * 0.25)) {
        watts = metrics.maxWatts;
        cadence = metrics.maxCadence;
      }
      
      trackpoints += `
          <Trackpoint>
            <Time>${pointTime}</Time>
            ${cadence ? `<Cadence>${cadence}</Cadence>` : ''}
            <Extensions>
              <ns3:TPX>
                <ns3:Watts>${watts}</ns3:Watts>
              </ns3:TPX>
            </Extensions>
          </Trackpoint>`;
    }
  }
  
  // Calculate estimated calories (rough approximation: 1 kJ ≈ 0.239 kcal)
  const estimatedCalories = Math.round(metrics.avgWatts * metrics.durationSeconds * 0.239 / 1000);

  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase
  xsi:schemaLocation="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2 http://www.garmin.com/xmlschemas/TrainingCenterDatabasev2.xsd"
  xmlns:ns5="http://www.garmin.com/xmlschemas/ActivityGoals/v1"
  xmlns:ns3="http://www.garmin.com/xmlschemas/ActivityExtension/v2"
  xmlns:ns2="http://www.garmin.com/xmlschemas/UserProfile/v2"
  xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Activities>
    <Activity Sport="Biking">
      <Id>${startTime.toISOString()}</Id>
      <Lap StartTime="${startTime.toISOString()}">
        <TotalTimeSeconds>${metrics.durationSeconds}</TotalTimeSeconds>
        <DistanceMeters>0</DistanceMeters>
        <Calories>${estimatedCalories}</Calories>
        <Intensity>Active</Intensity>
        <TriggerMethod>Manual</TriggerMethod>
        <Track>${trackpoints}
        </Track>
        <Extensions>
          <ns3:LX>
            <ns3:AvgWatts>${metrics.avgWatts}</ns3:AvgWatts>
            <ns3:MaxWatts>${metrics.maxWatts}</ns3:MaxWatts>
            ${metrics.avgCadence ? `<ns3:AvgCadence>${metrics.avgCadence}</ns3:AvgCadence>` : ''}
            ${metrics.maxCadence ? `<ns3:MaxCadence>${metrics.maxCadence}</ns3:MaxCadence>` : ''}
          </ns3:LX>
        </Extensions>
      </Lap>
    </Activity>
  </Activities>
</TrainingCenterDatabase>`;

  return tcx;
}
