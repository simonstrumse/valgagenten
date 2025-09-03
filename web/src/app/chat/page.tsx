"use client";
import { Suspense, useEffect, useState, useRef } from "react";
import { useChatStore } from "@/store/useChatStore";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

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

function ChatInner() {
  const { messages, addMessage, updateLastAssistant, setStreaming, streaming, progress, setProgress, conversationId, setConversation, profile, summary, topicWeights, setProfile, setSummary, setTopicWeights, saveCurrentToHistory, history, loadHistory, deleteHistory, reset } = useChatStore();
  const [input, setInput] = useState("");
  const [preview, setPreview] = useState<any>(null);
  const streamingRef = useRef(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const qs = useSearchParams();
  const [showHistory, setShowHistory] = useState(false);
  const [showResumeChoice, setShowResumeChoice] = useState(false);

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
      // keep scrolled to bottom while streaming
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
    setStreaming(false);
    streamingRef.current = false;
    // Update live summary/topic weights (best-effort)
    try {
      const resp = await fetch("/api/chat/summary", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messages, profile }) }).then((r) => r.json());
      if (resp?.summary) setSummary(resp.summary);
      if (resp?.topicWeights) setTopicWeights(resp.topicWeights);
    } catch {}
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
    const forceNew = qs.get("new") === "1";
    if (forceNew && messages.length) {
      saveCurrentToHistory();
      reset();
    }
    if (!forceNew && messages.length > 0) {
      setShowResumeChoice(true);
      return;
    }
    if (messages.length === 0) {
      addMessage({ role: "assistant", content: "Hei! Jeg er Chattomaten. Fortell gjerne kort hva som er viktig for deg i politikken (f.eks. klima, økonomi, Gaza/Ukraina, skole), så stiller jeg oppfølgingsspørsmål og viser samsvar med kilder underveis." });
      setProgress(5);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="min-h-screen px-0 py-0 bg-black text-white">
      <div className="grid lg:grid-cols-[1fr_320px] min-h-screen">
        <div className="flex flex-col max-w-3xl w-full mx-auto px-4 py-6">
      <div className="mb-3 flex items-center justify-between">
      <h1 className="text-2xl font-bold mb-2">Chattomaten</h1>
      <div className="flex items-center gap-2">
        <button onClick={() => { saveCurrentToHistory(); reset(); addMessage({ role: 'assistant', content: 'Ny samtale. Hva er viktigst for deg akkurat nå?' }); setProgress(5); }} className="px-3 py-1 rounded-full border border-neutral-700 text-xs">Ny samtale</button>
        <button onClick={() => setShowHistory((v) => !v)} className="px-3 py-1 rounded-full border border-neutral-700 text-xs">Tidligere samtaler</button>
      </div>
      </div>
      <p className="text-sm text-neutral-400 mb-6">Utforsk hva som er viktig for deg. Få samsvar med kilder.
        <span className="ml-2"><Link className="underline" href="/metode">Metode</Link></span>
      </p>

      <div className="mb-3 text-xs text-neutral-400">Grunnlag: <b className="text-white">{progress}%</b></div>

      {showResumeChoice ? (
        <div className="mb-4 p-3 rounded-2xl border border-neutral-800 bg-neutral-900/40 text-sm">
          Du har en pågående samtale. Vil du fortsette der, eller starte en ny?
          <div className="mt-2 flex gap-2">
            <button className="px-3 py-1 rounded-full border border-neutral-700" onClick={() => setShowResumeChoice(false)}>Fortsett</button>
            <button className="px-3 py-1 rounded-full border border-neutral-700" onClick={() => { saveCurrentToHistory(); reset(); addMessage({ role: 'assistant', content: 'Ny samtale. Hva er viktigst for deg akkurat nå?' }); setProgress(5); setShowResumeChoice(false); }}>Start ny</button>
          </div>
        </div>
      ) : null}
      <div
        ref={listRef}
        className="space-y-3 flex-1 overflow-auto"
        style={{ paddingBottom: "calc(10rem + env(safe-area-inset-bottom))" }}
      >
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`${m.role === "user" ? "bg-blue-600 text-white" : "bg-neutral-800 text-neutral-100"} rounded-2xl px-4 py-2 max-w-[80%] whitespace-pre-wrap`}>{m.content}
            {m.role === "assistant" && i === messages.length - 1 && streaming ? (
              <div className="mt-2 text-neutral-400"><TypingDots /></div>
            ) : null}
            </div>
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="mt-4 flex flex-col gap-2 fixed left-0 right-0 bottom-0 max-w-3xl w-full mx-auto px-4 py-3 bg-gradient-to-t from-black/80 to-black/0 pb-[env(safe-area-inset-bottom)]"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Hva er viktig for deg? …"
          className="flex-1 rounded-full border border-neutral-700 px-4 py-2 bg-transparent"
        />
        <div className="flex gap-2">
          <button disabled={streaming || !input.trim()} className="px-4 py-2 rounded-full bg-white text-black disabled:opacity-50">Send</button>
          <button type="button" onClick={seePreview} className="px-4 py-2 rounded-full border border-neutral-700">Se foreløpig samsvar</button>
        </div>
        <div className="flex gap-2 overflow-x-auto text-xs pb-1">
          {["Klima og energi", "Skatt for småbedrifter", "Gaza / internasjonal politikk", "Skole og lærere", "Helse og fastlege"].map((t) => (
            <button key={t} onClick={() => setInput(t)} className="px-2 py-1 rounded-full border border-neutral-700 hover:bg-white/5 whitespace-nowrap">{t}</button>
          ))}
        </div>
      </form>

      {/* Quick chips */}
      <div className="mt-16 flex flex-wrap gap-2 text-xs">
        {["Klima og energi", "Skatt for småbedrifter", "Gaza / internasjonal politikk", "Skole og lærere", "Helse og fastlege"].map((t) => (
          <button key={t} onClick={() => setInput(t)} className="px-2 py-1 rounded-full border border-neutral-700 hover:bg-white/5">{t}</button>
        ))}
        <button onClick={() => setInput("Jeg er 24 år i Oslo, student.")} className="px-2 py-1 rounded-full border border-neutral-700 hover:bg-white/5">Del alder/lokasjon</button>
        <button onClick={() => setInput("Jeg jobber i en liten bedrift og er opptatt av rammevilkår.")} className="px-2 py-1 rounded-full border border-neutral-700 hover:bg-white/5">Småbedrift</button>
      </div>
      {preview && (
        <div className="mt-6 rounded-2xl border border-neutral-800 p-3 bg-neutral-900/40">
          <div className="text-sm font-semibold mb-2">Foreløpig samsvar</div>
          <pre className="text-xs whitespace-pre-wrap text-neutral-300">{JSON.stringify(preview?.scores ?? preview, null, 2)}</pre>
        </div>
      )}
        </div>
        {/* Sidebar summary */}
        <aside className="hidden lg:flex flex-col border-l border-neutral-800 p-4 bg-neutral-950">
          <div className="text-sm font-semibold mb-2">Om deg – live</div>
          {showHistory && (
            <div className="mb-3 text-xs">
              <div className="font-semibold mb-1">Tidligere samtaler</div>
              <div className="space-y-1 max-h-48 overflow-auto pr-1">
                {history.length === 0 ? <div className="text-neutral-500">Ingen lagrede samtaler</div> : null}
                {history.map(h => (
                  <div key={h.id} className="flex items-center justify-between gap-2">
                    <button className="underline" onClick={() => loadHistory(h.id)}>{new Date(h.timestamp).toLocaleString()}</button>
                    <button className="text-neutral-500" onClick={() => deleteHistory(h.id)}>slett</button>
                  </div>
                ))}
              </div>
            </div>
          )}
          <label className="text-xs text-neutral-400">Oppsummering</label>
          <textarea value={summary || ""} onChange={(e) => setSummary(e.target.value)} className="mt-1 rounded-md border border-neutral-800 bg-transparent p-2 text-sm min-h-[120px]" placeholder="(Oppsummering vises her)" />
          <div className="grid grid-cols-2 gap-2 mt-3 text-sm">
            <div>
              <label className="text-xs text-neutral-400">Alder</label>
              <input type="number" value={profile?.age ?? ""} onChange={(e) => setProfile({ age: Number(e.target.value) || undefined })} className="mt-1 w-full rounded-md border border-neutral-800 bg-transparent p-1" />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Kommune</label>
              <input value={profile?.municipality ?? ""} onChange={(e) => setProfile({ municipality: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-800 bg-transparent p-1" />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Yrke</label>
              <input value={profile?.occupation ?? ""} onChange={(e) => setProfile({ occupation: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-800 bg-transparent p-1" />
            </div>
            <div>
              <label className="text-xs text-neutral-400">Bekymringer</label>
              <input value={profile?.concerns ?? ""} onChange={(e) => setProfile({ concerns: e.target.value })} className="mt-1 w-full rounded-md border border-neutral-800 bg-transparent p-1" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-xs text-neutral-400">Tema-vekter</div>
            <div className="mt-1 flex flex-wrap gap-2 text-xs">
              {topicWeights && Object.entries(topicWeights).map(([k, v]) => (
                <span key={k} className="px-2 py-1 rounded-full border border-neutral-800 bg-neutral-900/60">{k}: {Math.round((v as number) * 100)}</span>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense fallback={<div className="min-h-screen px-6 py-8 text-neutral-400">Laster chat …</div>}>
      <ChatInner />
    </Suspense>
  );
}
