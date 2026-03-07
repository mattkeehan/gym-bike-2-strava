import { useState } from 'react';
import Head from 'next/head';
import { extractTextFromImage } from '../lib/ocr';
import { parseWorkoutMetrics } from '../lib/parser';
import { generateTCX } from '../lib/tcx';
import { WorkoutMetrics } from '../types';

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [metrics, setMetrics] = useState<WorkoutMetrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [manualEdit, setManualEdit] = useState(false);
  
  // Editable fields
  const [editDuration, setEditDuration] = useState('');
  const [editMaxWatts, setEditMaxWatts] = useState('');
  const [editAvgWatts, setEditAvgWatts] = useState('');
  const [editMaxCadence, setEditMaxCadence] = useState('');
  const [editAvgCadence, setEditAvgCadence] = useState('');

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setExtractedText('');
      setMetrics(null);
      setError('');
      setManualEdit(false);
    }
  };

  const handleExtract = async () => {
    if (!file) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Extract text using OCR
      const text = await extractTextFromImage(file);
      setExtractedText(text);

      // Parse the extracted text
      const parsedMetrics = parseWorkoutMetrics(text);
      
      if (!parsedMetrics) {
        setError('Could not parse workout metrics. Please use manual entry below.');
        setManualEdit(true);
        return;
      }

      setMetrics(parsedMetrics);
      populateEditFields(parsedMetrics);
    } catch (err) {
      setError('Failed to extract workout data. Please try manual entry.');
      setManualEdit(true);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const populateEditFields = (m: WorkoutMetrics) => {
    const mins = Math.floor(m.durationSeconds / 60);
    const secs = m.durationSeconds % 60;
    setEditDuration(`${mins}:${secs.toString().padStart(2, '0')}`);
    setEditMaxWatts(m.maxWatts.toString());
    setEditAvgWatts(m.avgWatts.toString());
    setEditMaxCadence(m.maxCadence?.toString() || '');
    setEditAvgCadence(m.avgCadence?.toString() || '');
  };

  const handleManualSave = () => {
    // Parse duration (mm:ss)
    const durationMatch = editDuration.match(/(\d+):(\d+)/);
    if (!durationMatch) {
      setError('Invalid duration format. Use mm:ss');
      return;
    }

    const durationSeconds = parseInt(durationMatch[1]) * 60 + parseInt(durationMatch[2]);
    const maxWatts = parseInt(editMaxWatts);
    const avgWatts = parseInt(editAvgWatts);
    const maxCadence = editMaxCadence ? parseInt(editMaxCadence) : undefined;
    const avgCadence = editAvgCadence ? parseInt(editAvgCadence) : undefined;

    if (isNaN(durationSeconds) || isNaN(maxWatts) || isNaN(avgWatts)) {
      setError('Please enter valid numbers for duration and watts');
      return;
    }

    setMetrics({
      durationSeconds,
      maxWatts,
      avgWatts,
      maxCadence,
      avgCadence,
    });
    setError('');
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

  return (
    <>
      <Head>
        <title>Gym Bike to Strava</title>
        <meta name="description" content="Convert bike workout photos to Strava TCX files" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <main style={styles.main}>
        <h1 style={styles.title}>Gym Bike to Strava</h1>
        <p style={styles.subtitle}>
          Upload a photo of your workout screen and convert it to a Strava-compatible TCX file
        </p>

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

          {error && (
            <div style={styles.error}>
              {error}
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
                  <span style={styles.metricLabel}>Duration:</span>
                  <span style={styles.metricValue}>
                    {Math.floor(metrics.durationSeconds / 60)}:
                    {(metrics.durationSeconds % 60).toString().padStart(2, '0')}
                  </span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Average Watts:</span>
                  <span style={styles.metricValue}>{metrics.avgWatts}W</span>
                </div>
                <div style={styles.metric}>
                  <span style={styles.metricLabel}>Maximum Watts:</span>
                  <span style={styles.metricValue}>{metrics.maxWatts}W</span>
                </div>
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
              </div>

              <button
                onClick={handleDownloadTCX}
                style={styles.downloadButton}
              >
                Download TCX
              </button>
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
};
