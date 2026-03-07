# Gym Bike to Strava

Convert photos of stationary bike workout screens into Strava-uploadable TCX files with inferred power data and direct upload to Strava.

## Features

- 📸 Upload workout screen photos
- 🔍 OCR text extraction using Tesseract.js
- 📊 Parse workout metrics (duration, watts, cadence)
- 📈 Extract power-over-time from workout graphs
- 🎯 Infer realistic power traces from graph images
- 🔗 **NEW: Direct upload to Strava via OAuth**
- 📥 Generate and download Strava-compatible TCX files

## Getting Started

### Installation

```bash
npm install
```

### Strava API Setup

To enable direct upload to Strava:

1. Go to [https://www.strava.com/settings/api](https://www.strava.com/settings/api)
2. Create a new application with these settings:
   - **Application Name**: Your app name (e.g., "Gym Bike Converter")
   - **Category**: Training
   - **Website**: Your domain (for local dev: `http://localhost:3000`)
   - **Authorization Callback Domain**: Your domain without protocol
     - For local development: `localhost`
     - For production: `your-domain.com` (without `https://`)
3. Copy your **Client ID** and **Client Secret**
4. Create a `.env.local` file in the project root:

```bash
cp .env.local.example .env.local
```

5. Edit `.env.local` and add your credentials:

```
STRAVA_CLIENT_ID=your_client_id_here
STRAVA_CLIENT_SECRET=your_client_secret_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Build

```bash
npm run build
npm start
```

## Usage

### Quick Start

1. **(Optional)** Click **"Connect to Strava"** at the top to enable direct uploads
2. Take a photo of your bike's workout screen
3. Upload the image using the "Choose Image" button
4. Click "Extract Workout" to process the image with OCR
5. Review the extracted metrics (duration, watts, cadence)
6. *(Optional)* Manually edit any incorrect values
7. Click **"Send to Strava"** (if connected) or **"Download TCX"**

### Advanced: Infer Power Trace from Graph

For more accurate power data in Strava:

1. After extracting basic metrics, click **"Select Power Graph"**
2. Click and drag to draw a rectangle around the power graph in your image
3. Click **"Infer Power Trace"** to extract the blue trace
4. Review the power-over-time chart preview
5. Click **"Download TCX"** - the file will include your inferred power data

The app detects the bright blue graph line and converts it to approximate watts over time using your known average and max power values.

## Expected Text Format

The app expects workout screens to display text similar to:

```
40:31 mins on the bike
104 RPM maximum
82 RPM average
474 watts maximum
210 watts average
```

## Deploy to Vercel

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/gym-bike-2-strava)

Or manually:

```bash
npm install -g vercel
vercel
```

## Tech Stack

- **Framework**: Next.js 14
- **Language**: TypeScript
- **OCR**: Tesseract.js (client-side)
- **Image Processing**: sharp (server-side for graph extraction)
- **Authentication**: Strava OAuth2 (activity:write scope)
- **Storage**: File-based token storage (MVP - can be upgraded to database)
- **Deployment**: Vercel

## How It Works

### Power Graph Extraction

1. User selects a region of their image containing the power graph
2. Image is sent to server-side API route (`/api/extract-graph`)
3. Sharp library crops the image to the selected region
4. Blue pixels are detected and plotted to trace the graph line
5. Missing points are interpolated and smoothed
6. Graph is converted to power samples using workout metadata
7. TCX file includes realistic per-second power data

### Strava Integration

1. User clicks "Connect to Strava"
2. OAuth flow redirects to Strava for authorization
3. App requests `activity:write` scope
4. Tokens are stored securely (file-based for MVP)
5. Tokens automatically refresh when expired
6. Upload uses Strava's multipart/form-data upload endpoint
7. Status polling checks for processing completion

## Production Considerations

When deploying to production:

1. **Update Strava API Settings**:
   - Add your production domain to "Authorization Callback Domain"
   - Update "Website" field with your production URL

2. **Environment Variables**:
   - Set `STRAVA_CLIENT_ID` and `STRAVA_CLIENT_SECRET` in your hosting platform

3. **Token Storage** (recommended for production):
   - Replace file-based storage in `lib/strava-auth.ts` with a database
   - Look for `// TODO: Replace with database storage` comments
   - Suggested: PostgreSQL, MongoDB, or your preferred database

4. **Security**:
   - Ensure `.env.local` and `.strava-tokens.json` are in `.gitignore`
   - Use environment variables for all secrets
   - Consider adding user authentication to protect stored tokens

## Deploy to Vercel

1. Push your code to GitHub
2. Import your repository on Vercel
3. Add environment variables in Vercel dashboard:
   - `STRAVA_CLIENT_ID`
   - `STRAVA_CLIENT_SECRET`
4. Update Strava API settings with your Vercel domain
5. Deploy!

Or use the deploy button:

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/gym-bike-2-strava)

## Troubleshooting

### "Could not parse workout metrics"

- OCR may have had difficulty reading the text
- Try retaking the photo with better lighting
- Use the manual entry form to input values directly

### "Missing required scope: activity:write"

- When connecting to Strava, ensure you authorize the "Upload activities" permission
- Disconnect and reconnect if needed

### "Strava connection expired"

- Click "Connect to Strava" again to re-authorize
- Tokens automatically refresh but may expire after extended inactivity

### Power graph extraction issues

- Ensure you select only the graph area (not axes or labels)
- Works best with bright blue/cyan graph lines
- Try adjusting the crop box if results are inaccurate

## License

ISC
