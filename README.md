# Gym Bike to Strava

Convert photos of stationary bike workout screens into Strava-uploadable TCX files.

## Features

- 📸 Upload workout screen photos
- 🔍 OCR text extraction using Tesseract.js
- 📊 Parse workout metrics (duration, watts, cadence)
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

1. Take a photo of your bike's workout screen
2. Upload the image using the "Choose Image" button
3. Click "Extract Workout" to process the image
4. Review the extracted metrics
5. Click "Download TCX" to save the workout file
6. Upload the TCX file to Strava

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
