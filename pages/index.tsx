import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';
import { Analytics } from "@vercel/analytics/next"
import { generateTCX } from '../lib/tcx';
import { WorkoutMetrics } from '../types';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');
  const [resizedImageData, setResizedImageData] = useState<string>('');
  const [extractedText, setExtractedText] = useState<string>('');
  const [metrics, setMetrics] = useState<WorkoutMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [manualEdit, setManualEdit] = useState(false);
  
  // Ref for scrolling to results after successful extraction
  const resultsRef = useRef<HTMLDivElement>(null);
  
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

  // AI usage tracking helpers (localStorage-based, daily limit)
  const getTodayKey = (): string => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `ai-usage-${year}-${month}-${day}`;
  };

  const hasUsedAI = (): boolean => {
    if (typeof window === 'undefined') return false;
    const key = getTodayKey();
    return localStorage.getItem(key) === 'used';
  };

  const markAIUsed = (): void => {
    if (typeof window === 'undefined') return;
    const key = getTodayKey();
    localStorage.setItem(key, 'used');
  };

  // Helper to resize image before sending to API (reduces payload size)
  const resizeImageForAPI = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          // Calculate new dimensions (max width 1600px, maintain aspect ratio)
          const maxWidth = 1600;
          let width = img.width;
          let height = img.height;
          
          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }
          
          // Create canvas and draw resized image
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Failed to get canvas context'));
            return;
          }
          
          ctx.drawImage(img, 0, 0, width, height);
          
          // Convert to JPEG base64 (quality 0.85 for good balance)
          const resizedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve(resizedBase64);
        };
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedText('');
      setMetrics(null);
      setError('');
      setManualEdit(false);
      setResizedImageData('');
      
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

    // Check if AI was already used today
    if (hasUsedAI()) {
      setError('Free AI extraction used today. Try again tomorrow.');
      setManualEdit(true);
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Resize image to reduce payload size
      const resizedImageData = await resizeImageForAPI(file);
      
      // Store resized image for later use (e.g., Strava upload)
      setResizedImageData(resizedImageData);

      // Call AI extraction API (now the default)
      const response = await fetch('/api/extract-ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: resizedImageData,
          mimeType: 'image/jpeg',
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
        throw new Error('Could not extract duration from image');
      }

      setMetrics(parsedMetrics);
      populateEditFields(parsedMetrics);
      setExtractedText(`AI Extraction (confidence: ${aiResult.confidence ? (aiResult.confidence * 100).toFixed(0) : 'N/A'}%)
${aiResult.notes || ''}`);
      
      // Mark AI as used for today
      markAIUsed();
      
      // Scroll to results after successful extraction
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 100);
    } catch (err: any) {
      setError('AI extraction didn\'t work for this image.');
      setManualEdit(true);
      console.error('AI extraction error:', err);
    } finally {
      setLoading(false);
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

  const handleUploadAnother = () => {
    // Reset to allow uploading another photo
    setFile(null);
    setImagePreviewUrl('');
    setResizedImageData('');
    setMetrics(null);
    setExtractedText('');
    setError('');
    setManualEdit(false);
    setUploadStatus('');
    setStravaActivityId(null);
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

      // Use the resized image (same one sent to AI extraction)
      const photoBase64 = resizedImageData || imagePreviewUrl;

      const response = await fetch('/api/strava/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tcxContent,
          name,
          description,
          photo: photoBase64,
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
        <style>{`
          @keyframes successGlow {
            0%, 100% {
              box-shadow: 0 0 20px rgba(76, 175, 80, 0.4);
            }
            50% {
              box-shadow: 0 0 30px rgba(76, 175, 80, 0.7);
            }
          }
        `}</style>
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
          {/* Success Card - shown prominently after extraction */}
          {metrics && (
            <div ref={resultsRef} style={styles.successCard}>
              <h2 style={styles.successTitle}>✓ Workout extracted</h2>
              
              <div style={styles.compactSummary}>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Type:</span>
                  <span style={styles.summaryValue}>
                    {metrics.type === 'bike' ? 'Bike' : 'Run'}
                  </span>
                </div>
                <div style={styles.summaryRow}>
                  <span style={styles.summaryLabel}>Duration:</span>
                  <span style={styles.summaryValue}>
                    {Math.floor(metrics.durationSeconds / 60)}:
                    {(metrics.durationSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                
                {metrics.type === 'bike' ? (
                  <>
                    {metrics.avgWatts !== undefined && (
                      <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>Avg Watts:</span>
                        <span style={styles.summaryValue}>{metrics.avgWatts}W</span>
                      </div>
                    )}
                    {metrics.maxWatts !== undefined && (
                      <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>Max Watts:</span>
                        <span style={styles.summaryValue}>{metrics.maxWatts}W</span>
                      </div>
                    )}
                    {metrics.avgCadence && (
                      <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>Avg Cadence:</span>
                        <span style={styles.summaryValue}>{metrics.avgCadence} RPM</span>
                      </div>
                    )}
                    {metrics.maxCadence && (
                      <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>Max Cadence:</span>
                        <span style={styles.summaryValue}>{metrics.maxCadence} RPM</span>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    {metrics.avgPaceSeconds !== undefined && (
                      <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>Avg Pace:</span>
                        <span style={styles.summaryValue}>
                          {Math.floor(metrics.avgPaceSeconds / 60)}:
                          {(metrics.avgPaceSeconds % 60).toString().padStart(2, '0')} /km
                        </span>
                      </div>
                    )}
                    {metrics.distanceKm !== undefined && (
                      <div style={styles.summaryRow}>
                        <span style={styles.summaryLabel}>Distance:</span>
                        <span style={styles.summaryValue}>{metrics.distanceKm.toFixed(2)} km</span>
                      </div>
                    )}
                  </>
                )}
              </div>

              {/* Primary CTAs */}
              <div style={styles.successActions}>
                {stravaConnected ? (
                  <button
                    onClick={handleUploadToStrava}
                    disabled={uploadingToStrava}
                    style={{
                      ...styles.primaryButtonFullWidth,
                      ...(uploadingToStrava && styles.buttonDisabled),
                    }}
                  >
                    {uploadingToStrava ? 'Uploading...' : 'Send to Strava'}
                  </button>
                ) : (
                  <button
                    onClick={handleConnectStrava}
                    style={styles.primaryButtonFullWidth}
                  >
                    Connect to Strava
                  </button>
                )}
              </div>

              <div style={styles.secondaryActions}>
                <a onClick={handleUploadAnother} style={styles.secondaryLink}>
                  Upload another photo
                </a>
                {' · '}
                <a onClick={handleDownloadTCX} style={styles.downloadLink}>
                  Download TCX
                </a>
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

          {/* Upload section - only show if no metrics yet */}
          {!metrics && (
            <div style={styles.uploadArea}>
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
                disabled={!file || loading || hasUsedAI()}
                style={{
                  ...styles.button,
                  ...((!file || loading || hasUsedAI()) && styles.buttonDisabled),
                }}
              >
                {loading ? 'Extracting...' : hasUsedAI() ? 'AI used today — try again tomorrow' : 'Extract Workout'}
              </button>
              
              <div style={styles.helperText}>
                {hasUsedAI() ? 'Free daily AI extraction limit reached' : 'Uses AI for better results on most machines'}
              </div>
            </div>
          )}

          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}

          {/* Image preview */}
          {imagePreviewUrl && (
            <div style={styles.imageSection}>
              <h3 style={styles.sectionTitle}>Workout Image</h3>
              <img
                src={imagePreviewUrl}
                alt="Workout"
                style={styles.previewImage}
              />
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

          {extractedText && (
            <details style={styles.details}>
              <summary style={styles.summary}>View Extracted Text</summary>
              <pre style={styles.pre}>{extractedText}</pre>
            </details>
          )}
        </div>

        <footer style={styles.footer}>
          Want to upload more than one workout each day?{' '}
          <a 
            href="https://www.linkedin.com/in/matt-keehan-5910714/" 
            target="_blank" 
            rel="noopener noreferrer"
            style={styles.footerLink}
          >
            Contact me
          </a>
        </footer>
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
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: 'bold',
    margin: 0,
    color: '#333',
  },
  previewImage: {
    maxWidth: '100%',
    height: 'auto',
    borderRadius: '4px',
    display: 'block',
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
  helperText: {
    marginTop: '0.5rem',
    fontSize: '0.75rem',
    color: '#888',
    textAlign: 'center',
  },
  footer: {
    marginTop: '3rem',
    paddingTop: '2rem',
    borderTop: '1px solid #e0e0e0',
    textAlign: 'center',
    fontSize: '0.875rem',
    color: '#888',
  },
  footerLink: {
    color: '#2196F3',
    textDecoration: 'none',
    fontWeight: '500',
    transition: 'color 0.2s',
  },
  successCard: {
    marginBottom: '2rem',
    padding: '2rem',
    backgroundColor: '#f0f7ff',
    border: '2px solid #90caf9',
    borderRadius: '8px',
    boxShadow: '0 0 20px rgba(76, 175, 80, 0.4)',
    animation: 'successGlow 2s ease-in-out infinite',
  },
  successTitle: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    color: '#1565c0',
    margin: '0 0 1.5rem 0',
  },
  compactSummary: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '0.75rem',
    marginBottom: '1.5rem',
  },
  summaryRow: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '0.5rem',
    backgroundColor: 'white',
    borderRadius: '4px',
  },
  summaryLabel: {
    fontSize: '0.875rem',
    color: '#666',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: '0.875rem',
    fontWeight: 'bold',
    color: '#333',
  },
  successActions: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
  },
  primaryButton: {
    flex: 1,
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
  primaryButtonFullWidth: {
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
  secondaryActions: {
    textAlign: 'center',
    marginTop: '1rem',
  },
  secondaryLink: {
    fontSize: '0.875rem',
    color: '#2196F3',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  downloadLink: {
    fontSize: '0.75rem',
    color: '#999',
    textDecoration: 'underline',
    cursor: 'pointer',
  },
  uploadArea: {
    transition: 'all 0.3s ease',
  },
};
