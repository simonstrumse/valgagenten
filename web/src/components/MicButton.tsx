"use client";
import { useEffect, useRef, useState } from "react";

export function MicButton({ onText }: { onText: (text: string) => void }) {
  const [recording, setRecording] = useState(false);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  useEffect(() => {
    return () => {
      mediaRef.current?.stop();
    };
  }, []);

  const toggle = async () => {
    if (recording) {
      mediaRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRef.current = rec;
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = async () => {
        const blob = new Blob(chunks.current, { type: "audio/webm" });
        const fd = new FormData();
        fd.append("file", blob, "audio.webm");
        try {
          const res = await fetch("/api/stt", { method: "POST", body: fd });
          const data = await res.json();
          if (data?.text) onText(data.text);
        } catch (e) {
          console.error(e);
        }
      };
      rec.start();
      setRecording(true);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`px-3 py-2 rounded-md border ${recording ? "bg-red-600 text-white" : ""}`}
      aria-pressed={recording}
      aria-label="Hold for å snakke"
    >
      {recording ? "Stop" : "Snakk"}
    </button>
  );
}

