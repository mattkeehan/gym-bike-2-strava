/**
 * Strava API utilities for uploading and managing activities
 */

export interface StravaUploadResponse {
  id: number;
  id_str: string;
  external_id: string;
  error: string | null;
  status: string;
  activity_id: number | null;
}

export interface StravaUploadStatusResponse {
  id: number;
  id_str: string;
  external_id: string;
  error: string | null;
  status: string; // "Your activity is still being processed.", "Your activity is ready.", "There was an error processing your activity."
  activity_id: number | null;
}

/**
 * Upload a TCX file to Strava
 * @param accessToken Valid Strava access token
 * @param tcxContent TCX file content as string
 * @param name Optional activity name
 * @param description Optional activity description
 * @returns Upload response from Strava
 */
export async function uploadToStrava(
  accessToken: string,
  tcxContent: string,
  name?: string,
  description?: string
): Promise<StravaUploadResponse> {
  const url = 'https://www.strava.com/api/v3/uploads';

  // Create form data
  const formData = new FormData();
  
  // Create a blob for the TCX file
  const tcxBlob = new Blob([tcxContent], { type: 'application/xml' });
  formData.append('file', tcxBlob, 'workout.tcx');
  formData.append('data_type', 'tcx');
  
  if (name) {
    formData.append('name', name);
  }
  
  if (description) {
    formData.append('description', description);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Strava upload failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data as StravaUploadResponse;
}

/**
 * Check the status of an uploaded file
 * @param accessToken Valid Strava access token
 * @param uploadId Upload ID from initial upload response
 * @returns Current upload status
 */
export async function checkUploadStatus(
  accessToken: string,
  uploadId: number
): Promise<StravaUploadStatusResponse> {
  const url = `https://www.strava.com/api/v3/uploads/${uploadId}`;

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to check upload status: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data as StravaUploadStatusResponse;
}

/**
 * Get athlete info from Strava
 * @param accessToken Valid Strava access token
 * @returns Athlete data
 */
export async function getAthleteInfo(accessToken: string): Promise<any> {
  const url = 'https://www.strava.com/api/v3/athlete';

  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get athlete info: ${response.status} ${errorText}`);
  }

  return await response.json();
}
