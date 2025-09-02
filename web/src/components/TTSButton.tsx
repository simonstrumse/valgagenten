"use client";
import { useState } from "react";

export function TTSButton({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const play = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tts", { method: "POST", body: JSON.stringify({ text }) });
      if (!res.ok) throw new Error("TTS ikke tilgjengelig");
      const { url } = await res.json();
      const a = new Audio(url);
      setAudio(a);
      a.play();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };
  const stop = () => {
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
  };
  return (
    <div className="flex gap-2">
      <button onClick={play} disabled={loading} className="px-2 py-1 rounded border text-sm">
        {loading ? "Laster…" : "Les opp"}
      </button>
      <button onClick={stop} className="px-2 py-1 rounded border text-sm">Stopp</button>
    </div>
  );
}
