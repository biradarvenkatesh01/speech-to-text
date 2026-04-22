import dotenv from "dotenv";
dotenv.config({ override: true });

import express from "express";
import multer from "multer";
import cors from "cors";
import fs from "fs";
import { SarvamAIClient } from "sarvamai";
import { OpenRouter } from "@openrouter/sdk";

const app = express();
app.use(cors());

const PORT = process.env.PORT || 5000;

if (!process.env.SARVAM_API_KEY) {
  console.error("SARVAM_API_KEY missing!");
  process.exit(1);
}

if (!process.env.OPENROUTER_API_KEY) {
  console.error("OPENROUTER_API_KEY missing!");
  process.exit(1);
}

const upload = multer({ dest: "uploads/" });

const sarvamClient = new SarvamAIClient({
  apiSubscriptionKey: process.env.SARVAM_API_KEY
});

const openRouter = new OpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

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
posiible treatment: [list any potential treatments mentioned or implied in the transcript]
possible medication: [list any potential medications mentioned or implied in the transcript]
Subjective: [Summarize the patient's subjective complaints and history based on the transcript]
Objective: [Summarize the objective findings, such as physical exam results or test results, based on the transcript]
Assessment: [Provide a clinical assessment or diagnosis based on the subjective and objective information]
Plan: [Provide a plan for treatment or follow-up based on the assessment]
`;

    const completion = await openRouter.chat.send({
      model: "google/gemini-2.0-flash-001",
      messages: [{ role: "user", content: prompt }],
      stream: false,
    });

    const soapNote = completion.choices[0].message.content;

    res.json({
      success: true,
      transcript,
      soap_note: soapNote
    });

    console.log("🧾 SOAP Note:", soapNote);

  } catch (error) {
    console.error("OpenRouter Error:", error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(` Server running on port ${PORT}`);
});