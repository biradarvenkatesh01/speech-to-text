import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { SarvamAIClient } from "sarvamai";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;

console.log("Loaded API Key:", process.env.SARVAM_API_KEY);

if (!process.env.SARVAM_API_KEY) {
  console.error("API key missing!");
  process.exit(1);
}

const upload = multer({ dest: "uploads/" });

const client = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY
});

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: "No audio file uploaded"
      });
    }

    const filePath = req.file.path;
    const audioFile = fs.createReadStream(filePath);

    const response = await client.speechToText.transcribe({
      file: audioFile,
      model: "saaras:v3",
      mode: "transcribe"
    });

    console.log("FULL SARVAM RESPONSE:", response);

    fs.unlinkSync(filePath);

    // Send transcript clearly
    return res.json({
      success: true,
      transcript: response.transcript
    });


  } catch (error) {
    console.error("Transcription Error:", error);
    res.status(500).json({
      success: false,
      error: "Transcription failed"
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});