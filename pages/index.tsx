import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';
import { Analytics } from "@vercel/analytics/next"
import { extractTextFromImage } from '../lib/ocr';
import { parseWorkoutMetrics } from '../lib/parser';
import { generateTCX } from '../lib/tcx';
import { WorkoutMetrics, PowerSample } from '../types';

// Simple power chart component
function PowerChart({ powerSeries }: { powerSeries: PowerSample[] }) {
  if (powerSeries.length === 0) return <div>No data</div>;

  const maxWatts = Math.max(...powerSeries.map(s => s.watts));
  const minWatts = Math.min(...powerSeries.map(s => s.watts));
  const maxTime = Math.max(...powerSeries.map(s => s.time));
  
  const width = 600;
  const height = 200;
  const padding = 40;
  
  const xScale = (width - 2 * padding) / maxTime;
  const yScale = (height - 2 * padding) / (maxWatts - minWatts || 1);
  
  const points = powerSeries.map(s => {
    const x = padding + s.time * xScale;
    const y = height - padding - (s.watts - minWatts) * yScale;
    return `${x},${y}`;
  }).join(' ');
  
  return (
    <svg width={width} height={height} style={{ background: '#f9f9f9' }}>
      {/* Axes */}
      <line x1={padding} y1={padding} x2={padding} y2={height - padding} stroke="#666" />
      <line x1={padding} y1={height - padding} x2={width - padding} y2={height - padding} stroke="#666" />
      
      {/* Grid lines */}
      {[0, 0.25, 0.5, 0.75, 1].map(ratio => {
        const y = height - padding - ratio * (height - 2 * padding);
        const watts = Math.round(minWatts + ratio * (maxWatts - minWatts));
        return (
          <g key={ratio}>
            <line x1={padding} y1={y} x2={width - padding} y2={y} stroke="#ddd" />
            <text x={5} y={y + 4} fontSize="10" fill="#666">{watts}W</text>
          </g>
        );
      })}
      
      {/* Power line */}
      <polyline
        points={points}
        fill="none"
        stroke="#FC4C02"
        strokeWidth="2"
      />
      
      {/* Labels */}
      <text x={width / 2} y={height - 5} fontSize="12" fill="#666" textAnchor="middle">
        Time (seconds)
      </text>
    </svg>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [metrics, setMetrics] = useState<WorkoutMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingAI, setLoadingAI] = useState(false);
  const [error, setError] = useState<string>('');
  const [manualEdit, setManualEdit] = useState(false);
  const [showAISuggestion, setShowAISuggestion] = useState(false);
  
  // Graph extraction state
  const [cropMode, setCropMode] = useState(false);
  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [extractingGraph, setExtractingGraph] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  
  // Editable fields
  const [editDuration, setEditDuration] = useState('');
  const [editMaxWatts, setEditMaxWatts] = useState('');
  const [editAvgWatts, setEditAvgWatts] = useState('');
  const [editMaxCadence, setEditMaxCadence] = useState('');
  const [editAvgCadence, setEditAvgCadence] = useState('');
  
  // Run-specific fields
  const [editPace, setEditPace] = useState('');
  const [editCalories, setEditCalories] = useState('');
  const [editDistance, setEditDistance] = useState('');
  const [editWorkoutType, setEditWorkoutType] = useState<'bike' | 'run'>('bike');
  
  // Strava integration state
  const [stravaConnected, setStravaConnected] = useState(false);
  const [uploadingToStrava, setUploadingToStrava] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string>('');
  const [stravaActivityId, setStravaActivityId] = useState<string | null>(null);

  // Check if connected to Strava on mount
  useEffect(() => {
    // Check for OAuth callback status
    const params = new URLSearchParams(window.location.search);
    const stravaStatus = params.get('strava');
    const stravaMessage = params.get('message');
    
    if (stravaStatus === 'connected') {
      setStravaConnected(true);
      setUploadStatus('✓ Successfully connected to Strava!');
      // Clean up URL
      window.history.replaceState({}, '', '/');
    } else if (stravaStatus === 'error') {
      setError(`Strava connection failed: ${stravaMessage || 'unknown error'}`);
      // Clean up URL
      window.history.replaceState({}, '', '/');
    } else {
      // Check existing connection
      fetch('/api/strava/callback?check=true')
        .then(res => res.json())
        .then(data => {
          if (data.connected) {
            setStravaConnected(true);
          }
        })
        .catch(() => {
          // Silently fail - not connected
        });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedText('');
      setMetrics(null);
      setError('');
      setManualEdit(false);
      setCropBox(null);
      setCropMode(false);
      setShowAISuggestion(false);
      
      // Create preview URL
      const url = URL.createObjectURL(selectedFile);
      setImagePreviewUrl(url);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError('');
    setShowAISuggestion(false);

    try {
      // Extract text using OCR
      const text = await extractTextFromImage(file);
      setExtractedText(text);

      // Parse the extracted text
      const parsedMetrics = parseWorkoutMetrics(text);
      
      if (!parsedMetrics) {
        setError('Could not parse workout metrics. Please use manual entry below.');
        setManualEdit(true);
        setShowAISuggestion(true); // OCR completely failed
        return;
      }

      setMetrics(parsedMetrics);
      populateEditFields(parsedMetrics);

      // Check if metrics are incomplete and suggest AI extraction
      const incomplete = isMetricsIncomplete(parsedMetrics);
      if (incomplete) {
        setShowAISuggestion(true);
      }
    } catch (err) {
      setError('Failed to extract workout data. Please try manual entry.');
      setManualEdit(true);
      setShowAISuggestion(true); // OCR failed
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Helper to check if key metrics are missing
  const isMetricsIncomplete = (m: WorkoutMetrics): boolean => {
    // Missing duration is always incomplete
    if (!m.durationSeconds) return true;
    
    // For bike workouts, check watts
    if (m.type === 'bike') {
      if (!m.avgWatts || !m.maxWatts) return true;
    }
    
    // For run workouts, check pace or distance
    if (m.type === 'run') {
      if (!m.avgPaceSeconds && !m.distanceKm) return true;
    }
    
    return false;
  };

  const handleExtractWithAI = async () => {
    if (!file) {
      setError('Please select an image first');
      return;
    }

    setLoadingAI(true);
    setError('');

    try {
      // Convert file to base64
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Call AI extraction API
      const response = await fetch('/api/extract-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: fileData,
          mimeType: file.type,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'AI extraction failed');
      }

      const aiResult = await response.json();

      // Map AI response to WorkoutMetrics
      const machineType = aiResult.machineType === 'bike' ? 'bike' : 
                         aiResult.machineType === 'treadmill' ? 'run' : 'bike';
      
      const parsedMetrics: WorkoutMetrics = {
        type: machineType,
        durationSeconds: aiResult.durationSeconds || 0,
        avgWatts: aiResult.avgWatts ?? undefined,
        maxWatts: aiResult.maxWatts ?? undefined,
        avgCadence: aiResult.avgCadence ?? undefined,
        maxCadence: aiResult.maxCadence ?? undefined,
        avgPaceSeconds: aiResult.avgPace ? parsePaceToSeconds(aiResult.avgPace) : undefined,
        distanceKm: aiResult.distanceKm ?? undefined,
      };

      // Validate we have minimum required fields
      if (!parsedMetrics.durationSeconds) {
        throw new Error('AI could not extract duration. Please use manual entry.');
      }

      setMetrics(parsedMetrics);
      populateEditFields(parsedMetrics);
      setExtractedText(`AI Extraction (confidence: ${aiResult.confidence ? (aiResult.confidence * 100).toFixed(0) : 'N/A'}%)\n${aiResult.notes || ''}`);
      setShowAISuggestion(false); // Dismiss suggestion on success
    } catch (err: any) {
      setError(err.message || 'AI extraction failed. Try OCR or manual entry.');
      setManualEdit(true);
      console.error('AI extraction error:', err);
    } finally {
      setLoadingAI(false);
    }
  };

  // Helper to parse pace string like "5:30" to seconds
  const parsePaceToSeconds = (paceStr: string): number | undefined => {
    const match = paceStr.match(/(\d+):(\d+)/);
    if (match) {
      return parseInt(match[1]) * 60 + parseInt(match[2]);
    }
    return undefined;
  };

  const populateEditFields = (m: WorkoutMetrics) => {
    const mins = Math.floor(m.durationSeconds / 60);
    const secs = m.durationSeconds % 60;
    setEditDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    setEditWorkoutType(m.type);
    
    if (m.type === 'bike') {
      setEditMaxWatts(m.maxWatts?.toString() || '');
      setEditAvgWatts(m.avgWatts?.toString() || '');
      setEditMaxCadence(m.maxCadence?.toString() || '');
      setEditAvgCadence(m.avgCadence?.toString() || '');
    } else {
      const paceMins = Math.floor((m.avgPaceSeconds || 0) / 60);
      const paceSecs = (m.avgPaceSeconds || 0) % 60;
      setEditPace(`${paceMins}:${paceSecs.toString().padStart(2, '0')}`);
      setEditCalories(m.calories?.toString() || '');
      setEditDistance(m.distanceKm?.toFixed(2) || '');
    }
  };

  const handleManualSave = () => {
    // Parse duration (mm:ss)
    const durationMatch = editDuration.match(/(\d+):(\d+)/);
    if (!durationMatch) {
      setError('Invalid duration format. Use mm:ss');
      return;
    }

    const durationSeconds = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
    
    if (editWorkoutType === 'bike') {
      const maxWatts = parseInt(editMaxWatts);
      const avgWatts = parseInt(editAvgWatts);
      const maxCadence = editMaxCadence ? parseInt(editMaxCadence) : undefined;
      const avgCadence = editAvgCadence ? parseInt(editAvgCadence) : undefined;

      if (isNaN(durationSeconds) || isNaN(maxWatts) || isNaN(avgWatts)) {
        setError('Please enter valid numbers for duration and watts');
        return;
      }

      setMetrics({
        type: 'bike',
        durationSeconds,
        maxWatts,
        avgWatts,
        maxCadence,
        avgCadence,
      });
    } else {
      // Run workout
      const paceMatch = editPace.match(/(\d+):(\d+)/);
      const avgPaceSeconds = paceMatch ? parseInt(paceMatch[1]) * 60 + parseInt(paceMatch[2]) : undefined;
      const calories = editCalories ? parseInt(editCalories) : undefined;
      const distanceKm = editDistance ? parseFloat(editDistance) : undefined;
      
      if (isNaN(durationSeconds)) {
        setError('Please enter valid duration');
        return;
      }

      setMetrics({
        type: 'run',
        durationSeconds,
        avgPaceSeconds,
        calories,
        distanceKm,
      });
    }
    
    setError('');
  };

  // Crop selection handlers
  const handleImageMouseDown = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!cropMode || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    setCropStart({ x, y });
    setCropBox(null);
  };

  const handleImageMouseMove = (e: React.MouseEvent<HTMLImageElement>) => {
    if (!cropMode || !cropStart || !imageRef.current) return;
    
    const rect = imageRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const width = x - cropStart.x;
    const height = y - cropStart.y;
    
    setCropBox({
      x: width > 0 ? cropStart.x : x,
      y: height > 0 ? cropStart.y : y,
      width: Math.abs(width),
      height: Math.abs(height),
    });
  };

  const handleImageMouseUp = () => {
    setCropStart(null);
  };

  const handleExtractGraph = async () => {
    if (!file || !cropBox || !metrics) {
      setError('Please crop the power graph area first');
      return;
    }

    setExtractingGraph(true);
    setError('');

    try {
      // Read file as base64
      const reader = new FileReader();
      const fileData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(file);
      });

      // Scale crop box to actual image dimensions
      const img = imageRef.current;
      if (!img) throw new Error('Image not loaded');
      
      const scaleX = img.naturalWidth / img.clientWidth;
      const scaleY = img.naturalHeight / img.clientHeight;
      
      const scaledCrop = {
        x: cropBox.x * scaleX,
        y: cropBox.y * scaleY,
        width: cropBox.width * scaleX,
        height: cropBox.height * scaleY,
      };

      // Call API to extract graph
      const response = await fetch('/api/extract-graph', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: fileData,
          crop: scaledCrop,
          durationSeconds: metrics.durationSeconds,
          avgWatts: metrics.avgWatts,
          maxWatts: metrics.maxWatts,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to extract power trace');
      }

      const data = await response.json();
      
      // Update metrics with power series
      setMetrics({
        ...metrics,
        powerSeries: data.powerSeries,
      });
      
      setCropMode(false);
    } catch (err) {
      setError('Failed to extract power trace from graph');
      console.error(err);
    } finally {
      setExtractingGraph(false);
    }
  };


  const handleDownloadTCX = () => {
    if (!metrics) return;

    const tcxContent = generateTCX(metrics);
    const blob = new Blob([tcxContent], { type: 'application/xml' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = 'workout.tcx';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };
  
  const handleConnectStrava = () => {
    // Redirect to OAuth flow
    window.location.href = '/api/strava/connect';
  };
  
  const handleUploadToStrava = async () => {
    if (!metrics || !stravaConnected) return;

    setUploadingToStrava(true);
    setUploadStatus('Preparing upload...');
    setError('');

    try {
      const tcxContent = generateTCX(metrics);
      
      let name: string;
      let description: string;
      
      if (metrics.type === 'bike') {
        name = `Gym Bike Workout · via photo2strava`;
        description = `Duration: ${Math.floor(metrics.durationSeconds / 60)}:${(metrics.durationSeconds % 60).toString().padStart(2, '0')} | Avg: ${metrics.avgWatts}W | Max: ${metrics.maxWatts}W`;
      } else {
        name = `Treadmill Workout · via photo2strava`;
        const pace = metrics.avgPaceSeconds ? `${Math.floor(metrics.avgPaceSeconds / 60)}:${(metrics.avgPaceSeconds % 60).toString().padStart(2, '0')}/km` : 'N/A';
        const distance = metrics.distanceKm ? `${metrics.distanceKm.toFixed(2)}km` : 'N/A';
        description = `Duration: ${Math.floor(metrics.durationSeconds / 60)}:${(metrics.durationSeconds % 60).toString().padStart(2, '0')} | Pace: ${pace} | Distance: ${distance}`;
      }

      const response = await fetch('/api/strava/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tcxContent,
          name,
          description,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.code === 'NOT_CONNECTED') {
          setStravaConnected(false);
          throw new Error('Strava connection expired. Please reconnect.');
        }
        throw new Error(data.error || 'Upload failed');
      }

      setUploadStatus('Upload initiated! Processing...');

      // Poll for status
      let attempts = 0;
      const maxAttempts = 30; // 30 seconds max
      const uploadId = data.upload.id;

      const pollStatus = async () => {
        attempts++;
        
        const statusResponse = await fetch(`/api/strava/upload-status?uploadId=${uploadId}`);
        const statusData = await statusResponse.json();

        if (!statusResponse.ok) {
          throw new Error(statusData.error || 'Status check failed');
        }

        const status = statusData.status;

        if (status.activity_id) {
          // Success!
          setUploadStatus('✓ Uploaded successfully!');
          setStravaActivityId(status.activity_id.toString());
          setUploadingToStrava(false);
          return;
        }

        if (status.error) {
          throw new Error(`Strava error: ${status.error}`);
        }

        if (attempts >= maxAttempts) {
          setUploadStatus('Upload is taking longer than expected. Check your Strava account.');
          setUploadingToStrava(false);
          return;
        }

        // Still processing, check again in 1 seconds
        setTimeout(pollStatus, 1000);
      };

      setTimeout(pollStatus, 1000);

    } catch (err: any) {
      setError(err.message || 'Failed to upload to Strava');
      setUploadingToStrava(false);
      setUploadStatus('');
      setStravaActivityId(null);
    }
  };

  return (
    <>
      <Analytics/>
      <Head>
        <title>Gym Bike & Treadmill summary photo to Strava</title>
        <meta name="description" content="Convert bike and treadmill workout photos to Strava TCX files" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon.png?v=2" />
        <link rel="apple-touch-icon" href="/favicon.png?v=2" />
      </Head>

      <main style={styles.main}>
        <h1 style={styles.title}>Gym Bike & Treadmill summary photo to Strava</h1>
        <p style={styles.subtitle}>
          Upload a photo of your workout screen and push it straight to your Strava activities, or download a compatible TCX file
        </p>
        
        {/* Strava connection status */}
        <div style={styles.stravaSection}>
          {stravaConnected ? (
            <div style={styles.connectedBadge}>
              ✓ Connected to Strava
            </div>
          ) : (
            <button onClick={handleConnectStrava} style={styles.connectButton}>
              Connect to Strava
            </button>
          )}
        </div>

        <div style={styles.container}>
          <div style={styles.uploadSection}>
            <label htmlFor="file-upload" style={styles.uploadLabel}>
              {file ? file.name : 'Choose Image'}
            </label>
            <input
              id="file-upload"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
              style={styles.fileInput}
            />
          </div>

          <button
            onClick={handleExtract}
            disabled={!file || loading}
            style={{
              ...styles.button,
              ...((!file || loading) && styles.buttonDisabled),
            }}
          >
            {loading ? 'Extracting...' : 'Extract Workout'}
          </button>

          <div style={styles.aiButtonWrapper}>
            <button
              onClick={handleExtractWithAI}
              disabled={!file || loadingAI}
              style={{
                ...styles.aiButton,
                ...((!file || loadingAI) && styles.buttonDisabled),
              }}
            >
              {loadingAI ? 'Extracting with AI...' : 'Extract with AI (beta)'}
            </button>
            <span style={styles.aiButtonHint}>
              Better for messy photos and unusual screens
            </span>
          </div>

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {showAISuggestion && !loadingAI && (
            <div style={styles.aiSuggestion}>
              <div style={styles.aiSuggestionContent}>
                <span>💡 Having trouble with this photo? Try AI extraction (beta).</span>
                <button 
                  onClick={() => setShowAISuggestion(false)}
                  style={styles.dismissButton}
                  aria-label="Dismiss"
                >
                  ✕
                </button>
              </div>
            </div>
          )}

          {/* Image preview and graph extraction */}
          {imagePreviewUrl && (
            <div style={styles.imageSection}>
              <div style={styles.imageHeader}>
                <h3 style={styles.sectionTitle}>Workout Image</h3>
                {metrics && !metrics.powerSeries && (
                  <button
                    onClick={() => setCropMode(!cropMode)}
                    style={{
                      ...styles.toggleButton,
                      ...(cropMode && styles.toggleButtonActive),
                    }}
                  >
                    {cropMode ? 'Cancel Crop' : 'Select Power Graph'}
                  </button>
                )}
              </div>
              
              <div style={{ position: 'relative', display: 'inline-block' }}>
                <img
                  ref={imageRef}
                  src={imagePreviewUrl}
                  alt="Workout"
                  style={{
                    ...styles.previewImage,
                    ...(cropMode && { cursor: 'crosshair' }),
                  }}
                  onMouseDown={handleImageMouseDown}
                  onMouseMove={handleImageMouseMove}
                  onMouseUp={handleImageMouseUp}
                  onMouseLeave={handleImageMouseUp}
                />
                
                {/* Crop box overlay */}
                {cropBox && (
                  <div
                    style={{
                      position: 'absolute',
                      left: cropBox.x,
                      top: cropBox.y,
                      width: cropBox.width,
                      height: cropBox.height,
                      border: '2px dashed #FC4C02',
                      backgroundColor: 'rgba(252, 76, 2, 0.1)',
                      pointerEvents: 'none',
                    }}
                  />
                )}
              </div>
              
              {cropBox && metrics && (
                <button
                  onClick={handleExtractGraph}
                  disabled={extractingGraph}
                  style={styles.button}
                >
                  {extractingGraph ? 'Extracting...' : 'Infer Power Trace'}
                </button>
              )}
            </div>
          )}

          {/* Power series chart preview */}
          {metrics?.powerSeries && (
            <div style={styles.chartSection}>
              <h3 style={styles.sectionTitle}>Inferred Power Over Time</h3>
              <div style={styles.chartContainer}>
                <PowerChart powerSeries={metrics.powerSeries} />
              </div>
            </div>
          )}


          {(manualEdit || extractedText) && (
            <div style={styles.manualEntry}>
              <div style={styles.manualHeader}>
                <h3 style={styles.manualTitle}>Manual Entry / Edit Values</h3>
                <button
                  onClick={() => setManualEdit(!manualEdit)}
                  style={styles.toggleButton}
                >
                  {manualEdit ? 'Hide' : 'Show'} Form
                </button>
              </div>
              
              {manualEdit && (
                <div style={styles.manualForm}>
                  {/* Workout Type Selector */}
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Workout Type</label>
                    <select
                      value={editWorkoutType}
                      onChange={(e) => setEditWorkoutType(e.target.value as 'bike' | 'run')}
                      style={styles.input}
                    >
                      <option value="bike">Bike</option>
                      <option value="run">Treadmill / Run</option>
                    </select>
                  </div>
                  
                  <div style={styles.formGroup}>
                    <label style={styles.label}>Duration (mm:ss)</label>
                    <input
                      type="text"
                      value={editDuration}
                      onChange={(e) => setEditDuration(e.target.value)}
                      placeholder="40:31"
                      style={styles.input}
                    />
                  </div>
                  
                  {editWorkoutType === 'bike' ? (
                    <>
                      <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Max Watts</label>
                          <input
                            type="number"
                            value={editMaxWatts}
                            onChange={(e) => setEditMaxWatts(e.target.value)}
                            placeholder="474"
                            style={styles.input}
                          />
                        </div>
                        
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Avg Watts</label>
                          <input
                            type="number"
                            value={editAvgWatts}
                            onChange={(e) => setEditAvgWatts(e.target.value)}
                            placeholder="210"
                            style={styles.input}
                          />
                        </div>
                      </div>
                      
                      <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Max Cadence (optional)</label>
                          <input
                            type="number"
                            value={editMaxCadence}
                            onChange={(e) => setEditMaxCadence(e.target.value)}
                            placeholder="104"
                            style={styles.input}
                          />
                        </div>
                        
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Avg Cadence (optional)</label>
                          <input
                            type="number"
                            value={editAvgCadence}
                            onChange={(e) => setEditAvgCadence(e.target.value)}
                            placeholder="82"
                            style={styles.input}
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div style={styles.formRow}>
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Avg Pace (mm:ss/km)</label>
                          <input
                            type="text"
                            value={editPace}
                            onChange={(e) => setEditPace(e.target.value)}
                            placeholder="10:55"
                            style={styles.input}
                          />
                        </div>
                        
                        <div style={styles.formGroup}>
                          <label style={styles.label}>Calories</label>
                          <input
                            type="number"
                            value={editCalories}
                            onChange={(e) => setEditCalories(e.target.value)}
                            placeholder="290"
                            style={styles.input}
                          />
                        </div>
                      </div>
                      
                      <div style={styles.formGroup}>
                        <label style={styles.label}>Distance (km, optional)</label>
                        <input
                          type="number"
                          step="0.01"
                          value={editDistance}
                          onChange={(e) => setEditDistance(e.target.value)}
                          placeholder="Auto-calculated from duration/pace"
                          style={styles.input}
                        />
                      </div>
                    </>
                  )}
                  
                  <button
                    onClick={handleManualSave}
                    style={styles.saveButton}
                  >
                    Save & Generate TCX
                  </button>
                </div>
              )}
            </div>
          )}

          {metrics && (
            <div style={styles.results}>
              <h2 style={styles.resultsTitle}>Extracted Values</h2>
              <div style={styles.metricsList}>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Type:</span>
                  <span style={styles.metricValue}>
                    {metrics.type === 'bike' ? 'Bike' : 'Run'}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Duration:</span>
                  <span style={styles.metricValue}>
                    {Math.floor(metrics.durationSeconds / 60)}:
                    {(metrics.durationSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                {metrics.type === 'bike' ? (
                  <>
                    {metrics.avgWatts !== undefined && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Average Watts:</span>
                        <span style={styles.metricValue}>{metrics.avgWatts}W</span>
                      </div>
                    )}
                    {metrics.maxWatts !== undefined && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Maximum Watts:</span>
                        <span style={styles.metricValue}>{metrics.maxWatts}W</span>
                      </div>
                    )}
                    {metrics.avgCadence && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Average Cadence:</span>
                        <span style={styles.metricValue}>{metrics.avgCadence} RPM</span>
                      </div>
                    )}
                    {metrics.maxCadence && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Maximum Cadence:</span>
                        <span style={styles.metricValue}>{metrics.maxCadence} RPM</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {metrics.avgPaceSeconds !== undefined && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Average Pace:</span>
                        <span style={styles.metricValue}>
                          {Math.floor(metrics.avgPaceSeconds / 60)}:
                          {(metrics.avgPaceSeconds % 60).toString().padStart(2, '0')} /km
                        </span>
                      </div>
                    )}
                    {metrics.distanceKm !== undefined && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Distance:</span>
                        <span style={styles.metricValue}>{metrics.distanceKm.toFixed(2)} km</span>
                      </div>
                    )}
                    {metrics.calories !== undefined && (
                      <div style={styles.metric}>
                        <span style={styles.metricLabel}>Calories:</span>
                        <span style={styles.metricValue}>{metrics.calories} kcal</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              <div style={styles.actionButtons}>
                <button
                  onClick={handleDownloadTCX}
                  style={styles.downloadButton}
                >
                  Download TCX
                </button>
                
                {stravaConnected && (
                  <button
                    onClick={handleUploadToStrava}
                    disabled={uploadingToStrava}
                    style={{
                      ...styles.stravaButton,
                      ...(uploadingToStrava && styles.buttonDisabled),
                    }}
                  >
                    {uploadingToStrava ? 'Uploading...' : 'Send to Strava'}
                  </button>
                )}
              </div>
              
              {uploadStatus && (
                <div style={styles.uploadStatus}>
                  {uploadStatus}
                  {stravaActivityId && (
                    <>
                      {' '}
                      <a 
                        href={`https://www.strava.com/activities/${stravaActivityId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.stravaLink}
                      >
                        View on Strava
                      </a>
                    </>
                  )}
                </div>
              )}
            </div>
          )}

          {extractedText && (
            <details style={styles.details}>
              <summary style={styles.summary}>View Extracted Text</summary>
              <pre style={styles.pre}>{extractedText}</pre>
            </details>
          )}
        </div>
      </main>
    </>
  );
}

const styles: { [key: string]: React.CSSProperties } = {
  main: {
    minHeight: '100vh',
    padding: '2rem',
    backgroundColor: '#f5f5f5',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
  },
  title: {
    fontSize: '2.5rem',
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: '0.5rem',
    color: '#333',
  },
  subtitle: {
    textAlign: 'center',
    color: '#666',
    marginBottom: '2rem',
  },
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
  },
  uploadSection: {
    marginBottom: '1rem',
  },
  uploadLabel: {
    display: 'block',
    padding: '1rem',
    backgroundColor: '#f0f0f0',
    border: '2px dashed #ccc',
    borderRadius: '4px',
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  fileInput: {
    display: 'none',
  },
  button: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#FC4C02',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  buttonDisabled: {
    backgroundColor: '#ccc',
    cursor: 'not-allowed',
  },
  downloadButton: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#4CAF50',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '1rem',
  },
  error: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#ffebee',
    color: '#c62828',
    borderRadius: '4px',
    textAlign: 'center',
  },
  results: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  resultsTitle: {
    fontSize: '1.25rem',
    fontWeight: 'bold',
    marginBottom: '1rem',
    color: '#333',
  },
  metricsList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.75rem',
  },
  metric: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem',
    backgroundColor: 'white',
    borderRadius: '4px',
  },
  metricLabel: {
    fontWeight: '500',
    color: '#666',
  },
  metricValue: {
    fontWeight: 'bold',
    color: '#333',
  },
  details: {
    marginTop: '1.5rem',
  },
  summary: {
    cursor: 'pointer',
    fontWeight: '500',
    color: '#666',
    marginBottom: '0.5rem',
  },
  pre: {
    backgroundColor: '#f5f5f5',
    padding: '1rem',
    borderRadius: '4px',
    overflow: 'auto',
    fontSize: '0.875rem',
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  manualEntry: {
    marginTop: '1.5rem',
    padding: '1rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
  },
  manualHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  manualTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
  },
  toggleButton: {
    padding: '0.5rem 1rem',
    fontSize: '0.875rem',
    color: '#666',
    backgroundColor: 'white',
    border: '1px solid #ccc',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  manualForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem',
    flex: 1,
  },
  formRow: {
    display: 'flex',
    gap: '1rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: '#666',
  },
  input: {
    padding: '0.75rem',
    fontSize: '1rem',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: 'white',
  },
  saveButton: {
    padding: '0.75rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#2196F3',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    marginTop: '0.5rem',
  },
  imageSection: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  imageHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1rem',
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
  },
  toggleButtonActive: {
    backgroundColor: '#FC4C02',
    color: 'white',
    borderColor: '#FC4C02',
  },
  previewImage: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '4px',
    display: 'block',
  },
  chartSection: {
    marginTop: '2rem',
    padding: '1.5rem',
    backgroundColor: '#f9f9f9',
    borderRadius: '4px',
  },
  chartContainer: {
    marginTop: '1rem',
    overflowX: 'auto',
  },
  stravaSection: {
    maxWidth: '600px',
    margin: '0 auto 2rem',
    textAlign: 'center',
  },
  connectButton: {
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#FC4C02',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  connectedBadge: {
    display: 'inline-block',
    padding: '0.75rem 2rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: '#2e7d32',
    backgroundColor: '#e8f5e9',
    border: '2px solid #4caf50',
    borderRadius: '4px',
  },
  actionButtons: {
    display: 'flex',
    gap: '1rem',
    marginTop: '1rem',
  },
  stravaButton: {
    flex: 1,
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#FC4C02',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  },
  uploadStatus: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#e3f2fd',
    color: '#1565c0',
    borderRadius: '4px',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
  stravaLink: {
    color: '#FC4C02',
    fontWeight: 'bold',
    textDecoration: 'underline',
  },
  aiButtonWrapper: {
    marginTop: '1rem',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '0.5rem',
  },
  aiButton: {
    width: '100%',
    padding: '1rem',
    fontSize: '1rem',
    fontWeight: 'bold',
    color: 'white',
    backgroundColor: '#9C27B0',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  aiButtonHint: {
    fontSize: '0.75rem',
    color: '#888',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  aiSuggestion: {
    marginTop: '1rem',
    padding: '1rem',
    backgroundColor: '#f3e5f5',
    border: '1px solid #9C27B0',
    borderRadius: '4px',
  },
  aiSuggestionContent: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '1rem',
    color: '#6a1b9a',
    fontSize: '0.875rem',
  },
  dismissButton: {
    background: 'none',
    border: 'none',
    color: '#6a1b9a',
    fontSize: '1.25rem',
    cursor: 'pointer',
    padding: '0',
    lineHeight: '1',
    opacity: 0.7,
    transition: 'opacity 0.2s',
  },
};
