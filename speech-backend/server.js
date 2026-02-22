import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { SarvamAIClient } from "sarvamai";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;

if (!process.env.SARVAM_API_KEY) {
  console.error("SARVAM_API_KEY missing!");
  process.exit(1);
}

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY missing!");
  process.exit(1);
}

const upload = multer({ dest: "uploads/" });

const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY
});

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-3-flash-preview" });

app.post("/transcribe", upload.single("audio"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false });
    }

    const filePath = req.file.path;
    const audioFile = fs.createReadStream(filePath);

    const sttResponse = await sarvamClient.speechToText.transcribe({
      file: audioFile,
      model: "saaras:v3",
      mode: "translate"
    });

    fs.unlinkSync(filePath);

    const transcript = sttResponse.transcript;
    
console.log("📝 Transcript:", transcript);

    const prompt = `
Generate a structured SOAP note from this transcript.

Transcript:
"${transcript}"

Format strictly:

possible disease: [list any potential diagnoses based on the transcript]
Subjective:
Objective:
Assessment:
Plan:
`;

    const result = await model.generateContent(prompt);
    const soapNote = result.response.text();

    res.json({
      success: true,
      transcript,
      soap_note: soapNote
    });

    console.log("🧾 SOAP Note:", soapNote);

  } catch (error) {
    console.error("Gemini Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});
