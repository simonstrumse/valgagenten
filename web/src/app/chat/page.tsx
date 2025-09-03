"use client";
import { useEffect, useState, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";
import Link from "next/link";

function TypingDots() {
  return (
    <span aria-live="polite" className="inline-flex gap-1 items-center">
      <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.3s]"></span>
      <span className="w-2 h-2 rounded-full bg-current animate-bounce [animation-delay:-0.15s]"></span>
      <span className="w-2 h-2 rounded-full bg-current animate-bounce"></span>
    </span>
  );
}

async function streamChat(conversationId: string | undefined, userMessage: string, onChunk: (t: string) => void) {
  const res = await fetch("/api/chat/stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ conversationId, userMessage }),
  });
  if (!res.ok || !res.body) return "";
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let full = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    const chunk = decoder.decode(value);
    full += chunk;
    onChunk(chunk);
  }
  return full;
}

export default function ChatPage() {
  const { messages, addMessage, updateLastAssistant, setStreaming, streaming, progress, setProgress, conversationId, setConversation } = useChatStore();
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const streamingRef = useRef(false);

  const send = async () => {
    const text = input.trim();
    if (!text || streamingRef.current) return;
    addMessage({ role: "user", content: text });
    setInput("");
    streamingRef.current = true;
    setStreaming(true);
    addMessage({ role: "assistant", content: "" });
    await streamChat(conversationId, text, (chunk) => {
      updateLastAssistant((prev) => prev + chunk);
      setProgress(Math.min(100, progress + 5));
    });
    setStreaming(false);
    streamingRef.current = false;
    if (!conversationId) {
      // The server may create one; fetch preview to obtain id
      try {
        const p = await fetch(`/api/match/preview`).then((r) => r.json());
        setPreview(p);
        if (p?.conversationId) setConversation(p.conversationId);
      } catch {}
    }
  };

  const seePreview = async () => {
    const p = await fetch(`/api/match/preview${conversationId ? `?conversationId=${conversationId}` : ""}`).then((r) => r.json());
    setPreview(p);
  };

  // Bootstrap a friendly opening if empty
  useEffect(() => {
    if (messages.length === 0) {
      addMessage({ role: "assistant", content: "Hei! Jeg er Chattomaten. Fortell gjerne kort hva som er viktig for deg i politikken (f.eks. klima, økonomi, Gaza/Ukraina, skole), så stiller jeg oppfølgingsspørsmål og viser samsvar med kilder underveis." });
      setProgress(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Chattomaten</h1>
      <p className="text-sm text-muted-foreground mb-6">Utforsk hva som er viktig for deg. Få samsvar med kilder.
        <span className="ml-2"><Link className="underline" href="/metode">Metode</Link></span>
      </p>

      <div className="mb-3 text-xs">Grunnlag: <b>{progress}%</b></div>

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`rounded-md border p-3 ${m.role === "assistant" ? "bg-gray-50 dark:bg-gray-900/40" : ""}`}>
            <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "Chattomaten" : m.role === "user" ? "Du" : "System"}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
            {m.role === "assistant" && i === messages.length - 1 && streaming ? (
              <div className="mt-2 text-muted-foreground"><TypingDots /></div>
            ) : null}
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex gap-2"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hva er viktig for deg? …"
          className="flex-1 rounded-md border px-3 py-2 bg-transparent"
        />
        <button disabled={streaming || !input.trim()} className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black">
          Send
        </button>
        <button type="button" onClick={seePreview} className="px-4 py-2 rounded-md border">Se foreløpig samsvar</button>
      </form>

      {/* Quick chips */}
      <div className="mt-3 flex flex-wrap gap-2 text-xs">
        {["Klima og energi", "Skatt for småbedrifter", "Gaza / internasjonal politikk", "Skole og lærere", "Helse og fastlege"].map((t) => (
          <button key={t} onClick={() => setInput(t)} className="px-2 py-1 rounded-full border hover:bg-black/5 dark:hover:bg-white/10">{t}</button>
        ))}
        <button onClick={() => setInput("Jeg er 24 år i Oslo, student.")} className="px-2 py-1 rounded-full border hover:bg-black/5 dark:hover:bg-white/10">Del alder/lokasjon</button>
        <button onClick={() => setInput("Jeg jobber i en liten bedrift og er opptatt av rammevilkår.")} className="px-2 py-1 rounded-full border hover:bg-black/5 dark:hover:bg-white/10">Småbedrift</button>
      </div>

      {preview && (
        <div className="mt-6 rounded-md border p-3">
          <div className="text-sm font-semibold mb-2">Foreløpig samsvar</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(preview?.scores ?? preview, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
