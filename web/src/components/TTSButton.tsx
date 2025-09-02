"use client";
import { useState } from "react";

export function TTSButton({ text }: { text: string }) {
  const [loading, setLoading] = useState(false);
  const [audio, setAudio] = useState<HTMLAudioElement | null>(null);
  const [status, setStatus] = useState<string>("Klar");
  const play = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("TTS ikke tilgjengelig");
      let a: HTMLAudioElement;
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("audio")) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        a = new Audio(url);
      } else {
        const { url } = await res.json();
        a = new Audio(url);
      }
      setAudio(a);
      a.onplay = () => setStatus("Spiller av");
      a.onpause = () => setStatus("Stoppet");
      a.onended = () => setStatus("Ferdig");
      await a.play();
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
    <div className="flex gap-2 items-center">
      <button onClick={play} disabled={loading} className="px-2 py-1 rounded border text-sm">
        {loading ? "Laster…" : "Les opp"}
      </button>
      <button onClick={stop} className="px-2 py-1 rounded border text-sm">Stopp</button>
      <span aria-live="polite" className="text-xs text-muted-foreground">{status}</span>
    </div>
  );
}
