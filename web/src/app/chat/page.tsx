"use client";
import { useState, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";

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
  const { messages, addMessage, setStreaming, streaming, progress, setProgress, conversationId, setConversation } = useChatStore();
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
    const assistant = { role: "assistant" as const, content: "" };
    addMessage(assistant);
    await streamChat(conversationId, text, (chunk) => {
      assistant.content += chunk;
      // heuristic progress
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

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Chattomaten</h1>
      <p className="text-sm text-muted-foreground mb-6">Utforsk hva som er viktig for deg. Ingen stemmeråd, kun samsvar med kilder.</p>

      <div className="mb-3 text-xs">Grunnlag: <b>{progress}%</b></div>

      <div className="space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={`rounded-md border p-3 ${m.role === "assistant" ? "bg-gray-50 dark:bg-gray-900/40" : ""}`}>
            <div className="text-xs text-muted-foreground mb-1">{m.role === "assistant" ? "Chattomaten" : m.role === "user" ? "Du" : "System"}</div>
            <div className="whitespace-pre-wrap">{m.content}</div>
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

      {preview && (
        <div className="mt-6 rounded-md border p-3">
          <div className="text-sm font-semibold mb-2">Foreløpig samsvar</div>
          <pre className="text-xs whitespace-pre-wrap">{JSON.stringify(preview?.scores ?? preview, null, 2)}</pre>
        </div>
      )}
    </div>
  );
}
