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
  const [copied, setCopied] = useState(false);
  const [copiedSoap, setCopiedSoap] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [darkMode, setDarkMode] = useState(false);

  useEffect(() => {
    document.body.dataset.theme = darkMode ? "dark" : "light";
  }, [darkMode]);

  const startRecording = async () => {
    setError("");
    setCopied(false);
    setCopiedSoap(false);
    setSelectedFile(null);

    if (!navigator.mediaDevices?.getUserMedia) {
      setError("Your browser does not support audio capture.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setIsRecording(false);
        setIsProcessing(true);
        setStatus("Processing... (first request may take 20-30s)");

        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        const formData = new FormData();
        formData.append("audio", blob, "recording.webm");

        try {
          const response = await fetch(backendUrl, {
            method: "POST",
            body: formData
          });

          if (!response.ok) {
            throw new Error(`Server error (${response.status})`);
          }

          const data = await response.json();

          if (data.success) {
            setTranscript(data.transcript || "");
            setSoapNote(data.soap_note || "");
            setStatus("Done. Transcript and SOAP note ready.");
          } else {
            setError("Unexpected response from server.");
            setStatus("Idle. Press start to capture audio.");
          }
        } catch (fetchError) {
          setError("Request failed. Check console for details.");
          console.error(fetchError);
          setStatus("Idle. Press start to capture audio.");
        } finally {
          setIsProcessing(false);
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop());
            streamRef.current = null;
          }
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript("");
      setSoapNote("");
      setStatus("Recording... Speak clearly into the mic.");
    } catch (err) {
      console.error(err);
      setError("Microphone access denied.");
      setStatus("Idle. Press start to capture audio.");
    }
  };

  const stopRecording = () => {
    if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== "recording") {
      return;
    }

    setStatus("Finalizing audio...");
    mediaRecorderRef.current.stop();
  };

  const handleFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setSelectedFile(file);
  };

  const uploadAudioFile = async () => {
    if (!selectedFile) {
      return;
    }

    setError("");
    setCopied(false);
    setCopiedSoap(false);
    setIsProcessing(true);
    setStatus("Uploading... Processing audio file.");
    setTranscript("");
    setSoapNote("");

    const formData = new FormData();
    formData.append("audio", selectedFile, selectedFile.name);

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        body: formData
      });

      if (!response.ok) {
        throw new Error(`Server error (${response.status})`);
      }

      const data = await response.json();

      if (data.success) {
        setTranscript(data.transcript || "");
        setSoapNote(data.soap_note || "");
        setStatus("Done. Transcript and SOAP note ready.");
      } else {
        setError("Unexpected response from server.");
        setStatus("Idle. Press start to capture audio.");
      }
    } catch (fetchError) {
      setError("Upload failed. Check console for details.");
      console.error(fetchError);
      setStatus("Idle. Press start to capture audio.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCopy = async () => {
    if (!transcript || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(transcript);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch (copyError) {
      console.error(copyError);
    }
  };

  const handleCopySoap = async () => {
    if (!soapNote || !navigator.clipboard?.writeText) {
      return;
    }

    try {
      await navigator.clipboard.writeText(soapNote);
      setCopiedSoap(true);
      setTimeout(() => setCopiedSoap(false), 1500);
    } catch (copyError) {
      console.error(copyError);
    }
  };

  const handleDownloadPdf = () => {
    if (!soapNote) {
      return;
    }

    const printable = `
      <!doctype html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Arogya-Lipi SOAP Note</title>
          <style>
            body { font-family: "Segoe UI", Arial, sans-serif; padding: 40px; color: #12212b; }
            h1 { font-size: 22px; margin: 0 0 12px; }
            h2 { font-size: 16px; margin: 24px 0 8px; }
            pre { white-space: pre-wrap; font-family: "Segoe UI", Arial, sans-serif; font-size: 14px; }
            .meta { color: #5c6c77; font-size: 12px; }
          </style>
        </head>
        <body>
          <h1>Arogya-Lipi — SOAP Note</h1>
          <div class="meta">Generated: ${new Date().toLocaleString()}</div>
          <h2>SOAP Note</h2>
          <pre>${soapNote.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>
        </body>
      </html>
    `;

    const win = window.open("", "_blank", "width=900,height=700");
    if (!win) {
      return;
    }
    win.document.open();
    win.document.write(printable);
    win.document.close();
    win.focus();
    win.print();
  };

  const statusClass = isRecording
    ? "status status-recording"
    : isProcessing
      ? "status status-processing"
      : error
        ? "status status-error"
        : "status";

  return (
    <div className="app">
      <main className="panel">
        <header className="panel-header">
          <div>
            <p className="label">Arogya-Lipi</p>
            <h1>AI Clinical SOAP Generator</h1>
          </div>
          <div className="header-actions">
            <button
              className="btn btn-toggle"
              onClick={() => setDarkMode((prev) => !prev)}
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
            Start Recording
          </button>
          <button
            className="btn btn-stop"
            onClick={stopRecording}
            disabled={!isRecording || isProcessing}
          >
            Stop Recording
          </button>
          <label className="file-upload">
            <input
              type="file"
              accept="audio/mpeg,audio/mp3,audio/wav,audio/webm,audio/ogg"
              onChange={handleFileChange}
              disabled={isRecording || isProcessing}
            />
            <span className="btn btn-upload">
              {selectedFile ? "Change File" : "Upload MP3"}
            </span>
          </label>
          <button
            className="btn btn-process"
            onClick={uploadAudioFile}
            disabled={!selectedFile || isRecording || isProcessing}
          >
            Process File
          </button>
        </section>

        {selectedFile && (
          <section className="file-status">
            <span className="status-label">Selected File</span>
            <p>{selectedFile.name}</p>
          </section>
        )}

        <section className={statusClass}>
          <span className="status-label">Status</span>
          <p>{error ? error : status}</p>
        </section>

        <section className="transcript">
          <div className="transcript-header">
            <h2>Transcript</h2>
            <button
              className="btn btn-copy"
              onClick={handleCopy}
              disabled={!transcript}
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="transcript-body">
            {transcript || "Your transcript will appear here..."}
          </div>
        </section>

        <section className="transcript soap">
          <div className="transcript-header">
            <h2>SOAP Note</h2>
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
                onClick={handleDownloadPdf}
                disabled={!soapNote}
              >
                Download PDF
              </button>
            </div>
          </div>
          <pre className="soap-body">
            {soapNote || "SOAP note will appear here..."}
          </pre>
        </section>

        <footer className="panel-footer">
          <p>Backend: {backendUrl}</p>
          <p>Tip: Use headphones to avoid echo while recording.</p>
        </footer>
      </main>
    </div>
  );
}


