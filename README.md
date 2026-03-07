# Gym Bike to Strava

Convert photos of stationary bike workout screens into Strava-uploadable TCX files with inferred power data.

## Features

- 📸 Upload workout screen photos
- 🔍 OCR text extraction using Tesseract.js
- 📊 Parse workout metrics (duration, watts, cadence)
- 📈 **NEW: Extract power-over-time from workout graphs**
- 🎯 Infer realistic power traces from graph images
- 📥 Generate and download Strava-compatible TCX files

## Getting Started

### Installation

```bash
npm install
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

### Basic Workflow

1. Take a photo of your bike's workout screen
2. Upload the image using the "Choose Image" button
3. Click "Extract Workout" to process the image with OCR
4. Review the extracted metrics (duration, watts, cadence)
5. *(Optional)* Manually edit any incorrect values

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
- **OCR**: Tesseract.js
- **Deployment**: Vercel

## License

ISC
