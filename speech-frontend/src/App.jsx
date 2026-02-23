import { useEffect, useMemo, useRef, useState } from "react";

const FALLBACK_BACKEND_URL = "https://speech-to-text-1-hm5c.onrender.com/transcribe";

export default function App() {
  const backendUrl = useMemo(() => {
    return import.meta.env.VITE_BACKEND_URL || FALLBACK_BACKEND_URL;
  }, []);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);

  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [soapNote, setSoapNote] = useState("");
  const [status, setStatus] = useState("Idle. Press start to capture audio.");
  const [error, setError] = useState("");
  const [selectedFile, setSelectedFile] = useState(null);
  const [darkMode, setDarkMode] = useState(false);
  const [copiedTranscript, setCopiedTranscript] = useState(false);
  const [copiedSoap, setCopiedSoap] = useState(false);

  useEffect(() => {
    document.body.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  // Parse SOAP sections
  const parseSoap = (text) => {
    if (!text) return {};

    const getSection = (title) => {
      const regex = new RegExp(`${title}:([\\s\\S]*?)(?=\\n[A-Z][a-zA-Z ]+:|$)`, "i");
      const match = text.match(regex);
      return match ? match[1].trim() : "Not provided.";
    };

    return {
      disease: getSection("possible disease"),
      treatment: getSection("possible treatment"),
      medication: getSection("possible medication"),
      subjective: getSection("Subjective"),
      objective: getSection("Objective"),
      assessment: getSection("Assessment"),
      plan: getSection("Plan")
    };
  };

  const soapSections = parseSoap(soapNote);

  const startRecording = async () => {
    setError("");
    setSelectedFile(null);
    setCopiedTranscript(false);
    setCopiedSoap(false);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        setStatus("Processing...");

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        await sendAudio(blob);

        setIsProcessing(false);
        stream.getTracks().forEach((t) => t.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript("");
      setSoapNote("");
      setStatus("Recording...");
    } catch (err) {
      setError("Microphone access denied.");
    }
  };

  const stopRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const uploadAudioFile = async () => {
    if (!selectedFile) return;
    setCopiedTranscript(false);
    setCopiedSoap(false);
    setIsProcessing(true);
    setStatus("Processing uploaded file...");
    setTranscript("");
    setSoapNote("");
    await sendAudio(selectedFile);
    setIsProcessing(false);
  };

  const sendAudio = async (fileOrBlob) => {
    const formData = new FormData();
    formData.append("audio", fileOrBlob);

    try {
      const res = await fetch(backendUrl, {
        method: "POST",
        body: formData
      });

      const data = await res.json();

      if (data.success) {
        setTranscript(data.transcript || "");
        setSoapNote(data.soap_note || "");
        setStatus("Done.");
        setError("");
      } else {
        setError("Server returned unexpected response.");
      }
    } catch (err) {
      console.error(err);
      setError("Request failed.");
    }
  };

  const handleCopyTranscript = async () => {
    if (!transcript || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(transcript);
    setCopiedTranscript(true);
    setTimeout(() => setCopiedTranscript(false), 1500);
  };

  const handleCopySoap = async () => {
    if (!soapNote || !navigator.clipboard?.writeText) return;
    await navigator.clipboard.writeText(soapNote);
    setCopiedSoap(true);
    setTimeout(() => setCopiedSoap(false), 1500);
  };

  const handleDownloadSoapPdf = () => {
    if (!soapNote) return;

    const sections = [
      { title: "Possible Disease", content: soapSections.disease },
      { title: "Possible Treatment", content: soapSections.treatment },
      { title: "Possible Medication", content: soapSections.medication },
      { title: "Subjective", content: soapSections.subjective },
      { title: "Objective", content: soapSections.objective },
      { title: "Assessment", content: soapSections.assessment },
      { title: "Plan", content: soapSections.plan }
    ];

    const cardsHtml = sections
      .map(
        (section) => `
        <div class="card">
          <div class="card-title">${section.title}</div>
          <div class="card-body">${(section.content || "Not provided.").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</div>
        </div>
      `
      )
      .join("");

    const html = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Arogya-Lipi SOAP Report</title>
          <style>
            * { box-sizing: border-box; }
            body {
              font-family: "Segoe UI", Arial, sans-serif;
              margin: 0;
              padding: 32px;
              color: #0f233d;
              background: #f7faff;
            }
            h1 {
              margin: 0 0 4px;
              font-size: 22px;
            }
            .meta {
              color: #52627a;
              font-size: 12px;
              margin-bottom: 16px;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
              gap: 12px;
            }
            .card {
              background: #ffffff;
              border: 1px solid #d9e3f0;
              padding: 12px 14px;
              border-radius: 8px;
            }
            .card-title {
              font-weight: 700;
              color: #2b6cb0;
              margin-bottom: 6px;
              font-size: 13px;
              text-transform: uppercase;
              letter-spacing: 0.06em;
            }
            .card-body {
              white-space: pre-wrap;
              font-size: 14px;
              line-height: 1.5;
            }
          </style>
        </head>
        <body>
          <h1>Arogya-Lipi — SOAP Report</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <div class="grid">
            ${cardsHtml}
          </div>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) return;
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    win.print();
  };

  const SoapCard = ({ title, content }) => (
    <div className="soap-card">
      <h3>{title}</h3>
      <p>{content}</p>
    </div>
  );

  const statusClass = `status ${error ? "status-error" : isProcessing ? "status-processing" : isRecording ? "status-recording" : ""}`;

  return (
    <div className="app">
      <main className="panel">
        <header className="panel-header">
          <h1>Arogya-Lipi — AI SOAP Generator</h1>
          <div className="header-actions">
            <button
              className="btn btn-toggle"
              onClick={() => setDarkMode(!darkMode)}
              type="button"
            >
              {darkMode ? "Light Mode" : "Dark Mode"}
            </button>
            <div className={`indicator ${isRecording ? "indicator-on" : ""}`}>
              <span className="indicator-dot" />
              <span className="indicator-text">{isRecording ? "REC" : "STBY"}</span>
            </div>
          </div>
        </header>

        <section className="controls">
          <button
            className="btn btn-start"
            onClick={startRecording}
            disabled={isRecording || isProcessing}
          >
            Start
          </button>
          <button
            className="btn btn-stop"
            onClick={stopRecording}
            disabled={!isRecording || isProcessing}
          >
            Stop
          </button>
          <label className="file-upload">
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              disabled={isRecording || isProcessing}
            />
            <span className="btn btn-upload">
              {selectedFile ? "Change File" : "Upload Audio"}
            </span>
          </label>
          <button
            className="btn btn-process"
            onClick={uploadAudioFile}
            disabled={!selectedFile || isProcessing}
          >
            Upload
          </button>
        </section>

        {selectedFile && (
          <section className="file-status">
            <span className="status-label">Selected File</span>
            <p>{selectedFile.name}</p>
          </section>
        )}

        <section className={statusClass}>
          <p>{error || status}</p>
        </section>

        <section className="transcript">
          <div className="transcript-header">
            <h2>Transcript</h2>
            <button
              className="btn btn-copy"
              onClick={handleCopyTranscript}
              disabled={!transcript}
            >
              {copiedTranscript ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="transcript-body">
            {transcript || "Transcript will appear here..."}
          </div>
        </section>

        <section className="soap">
          <div className="transcript-header">
            <h2>SOAP Report</h2>
            <div className="soap-actions">
              <button
                className="btn btn-copy"
                onClick={handleCopySoap}
                disabled={!soapNote}
              >
                {copiedSoap ? "Copied" : "Copy"}
              </button>
              <button
                className="btn btn-download"
                onClick={handleDownloadSoapPdf}
                disabled={!soapNote}
              >
                Download PDF
              </button>
            </div>
          </div>

          {soapNote ? (
            <div className="soap-grid">
              <SoapCard title="Possible Disease" content={soapSections.disease} />
              <SoapCard title="Possible Treatment" content={soapSections.treatment} />
              <SoapCard title="Possible Medication" content={soapSections.medication} />
              <SoapCard title="Subjective" content={soapSections.subjective} />
              <SoapCard title="Objective" content={soapSections.objective} />
              <SoapCard title="Assessment" content={soapSections.assessment} />
              <SoapCard title="Plan" content={soapSections.plan} />
            </div>
          ) : (
            <p>SOAP note will appear here...</p>
          )}
        </section>
      </main>
    </div>
  );
}
