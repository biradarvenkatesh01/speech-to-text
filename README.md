# Arogya-Lipi — Speech-to-Text & SOAP Note Generator

A full-stack app that records or uploads audio, transcribes it, and generates a structured SOAP note. The backend uses SarvamAI Speech-to-Text for transcription and Google Gemini for SOAP summarization. The frontend provides a retro-styled UI with recording, upload, copy, and PDF export.

## What It Does
- Record audio in the browser or upload an audio file
- Transcribe speech to text via SarvamAI (translation mode)
- Generate a SOAP note using Gemini
- View results in the UI, copy to clipboard, or export a printable PDF

## Tech Stack
- **Frontend:** React + Vite
- **Backend:** Node.js + Express
- **Speech-to-Text:** SarvamAI (`saaras:v3`)
- **Summarization:** Google Gemini (`gemini-3-flash-preview`)

## Project Structure
- `speech-frontend/` — React UI
- `speech-backend/` — Express API
- `speech-backend/uploads/` — Temporary upload storage

## Setup

### 1) Install dependencies

Backend:
```bash
cd speech-backend
npm install
```

Frontend:
```bash
cd speech-frontend
npm install
```

### 2) Configure environment variables

Create a `.env` in `speech-backend/`:
```
PORT=5000
SARVAM_API_KEY=your_sarvam_key
GEMINI_API_KEY=your_gemini_key
```

Optional frontend override in `speech-frontend/.env`:
```
VITE_BACKEND_URL=http://localhost:5000/transcribe
```

If `VITE_BACKEND_URL` is not set, the frontend falls back to:
```
https://speech-to-text-1-hm5c.onrender.com/transcribe
```

### 3) Run the app

Backend:
```bash
cd speech-backend
npm start
```

Frontend:
```bash
cd speech-frontend
npm run dev
```

Then open the Vite dev server URL shown in your terminal.

## API

### `POST /transcribe`
- **Content-Type:** `multipart/form-data`
- **Field name:** `audio`

**Response**
```json
{
  "success": true,
  "transcript": "...",
  "soap_note": "..."
}
```

## Frontend Features
- Start/stop audio recording (MediaRecorder)
- Upload audio files (`.mp3`, `.wav`, `.webm`, `.ogg`)
- Dark mode toggle
- Copy transcript or SOAP note
- Download SOAP note as a printable PDF

## Notes
- The backend requires both `SARVAM_API_KEY` and `GEMINI_API_KEY` at startup.
- Uploaded audio is stored in `speech-backend/uploads/` temporarily and deleted after processing.
- SOAP parsing in the UI expects the exact section labels from the backend prompt.
