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
You are an expert medical scribe and clinical documentation specialist.

A doctor-patient conversation has been transcribed below. Generate a highly detailed, accurate, and professional SOAP note from it.

Rules:
- Extract every clinical detail mentioned, no matter how small
- If something is not mentioned in the transcript, write "Not mentioned"
- Do NOT make up or assume any information not present in the transcript
- Use proper medical terminology

Transcript:
"${transcript}"

Generate the SOAP note in this exact format:

Possible Disease: [Potential diagnoses with brief clinical reasoning]
Possible Treatment: [Treatments mentioned or clinically implied]
Possible Medication: [Medications mentioned or commonly used for above conditions]

Subjective:
- Chief Complaint: [Main reason for visit]
- History of Present Illness: [Symptoms, onset, duration, severity, aggravating/relieving factors]
- Past Medical History: [Prior conditions mentioned]
- Current Medications: [Medications patient is already taking]
- Allergies: [Any allergies mentioned]
- Family History: [Any family history mentioned]
- Social History: [Lifestyle, smoking, alcohol etc. if mentioned]

Objective:
- Vital Signs: [Any vitals mentioned]
- Physical Examination: [Exam findings]
- Investigations/Lab Results: [Any tests or results mentioned]

Assessment:
[Clinical assessment and working diagnosis based on subjective and objective data]

Plan:
- Investigations Ordered: [Tests to be done]
- Treatment: [Treatment plan]
- Medications: [Prescribed medications with dosage if mentioned]
- Follow-up: [Follow-up instructions]
- Patient Education: [Advice or instructions given to patient]
`;

    const completion = await openRouter.chat.send({
      model: "meta-llama/llama-3.3-70b-instruct:free",
      messages: [
        {
          role: "system",
          content: "You are a highly experienced medical scribe and clinical documentation specialist. Generate accurate, detailed, and professional SOAP notes from doctor-patient conversation transcripts. Never fabricate clinical details."
        },
        {
          role: "user",
          content: prompt
        }
      ],
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