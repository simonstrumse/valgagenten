"use client";
import { useEffect, useMemo, useState } from "react";
import { useDebateStore } from "@/store/useDebateStore";

export default function DebatePage() {
  const { topic, party, sessionId, rounds, setRound } = useDebateStore();
  const [input, setInput] = useState("");
  const currentRound = useMemo(() => rounds.find((r) => !r.judgeScore) ?? rounds[0], [rounds]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Fetch opening argument for the first round if missing
    const run = async () => {
      if (!sessionId || !topic || !party) return;
      if (!currentRound.aiOpening) {
        try {
          const res = await fetch("/api/ai/opening", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, topic, party, round: currentRound.index }),
          });
          const data = await res.json();
          setRound(currentRound.index, { aiOpening: data.text ?? "" });
        } catch (e) {
          console.error(e);
        }
      }
    };
    run();
  }, [sessionId, topic, party, currentRound, setRound]);

  const submit = async () => {
    if (!input.trim() || !sessionId || !topic || !party) return;
    setLoading(true);
    try {
      // Save user reply
      setRound(currentRound.index, { userReply: input.trim() });
      setInput("");
      // Get rebuttal
      const rebut = await fetch("/api/ai/rebuttal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, topic, party, round: currentRound.index, userText: input.trim() }),
      }).then((r) => r.json());
      setRound(currentRound.index, { aiRebuttal: rebut.text ?? "" });
      // Judge
      const judge = await fetch("/api/judge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, topic, party, aiText: currentRound.aiOpening, userText: input.trim(), round: currentRound.index }),
      }).then((r) => r.json());
      setRound(currentRound.index, { judgeScore: judge.score, judgeNotes: judge.rationale });
    } finally {
      setLoading(false);
    }
  };

  const over = rounds.every((r) => typeof r.judgeScore === "number");

  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <div className="text-sm text-muted-foreground">Tema</div>
          <div className="font-semibold">{topic ?? "–"}</div>
        </div>
        <div>
          <div className="text-sm text-muted-foreground">Parti</div>
          <div className="font-semibold">{party ?? "–"}</div>
        </div>
        <div className="text-sm">Runde {currentRound.index}/3</div>
      </header>

      <main className="space-y-4">
        {currentRound.aiOpening && (
          <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-900/40" aria-live="polite">
            <div className="text-xs text-muted-foreground mb-1">Parti-Agent</div>
            <p>{currentRound.aiOpening}</p>
          </div>
        )}

        {currentRound.userReply && (
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground mb-1">Du</div>
            <p>{currentRound.userReply}</p>
          </div>
        )}

        {currentRound.aiRebuttal && (
          <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-900/40">
            <div className="text-xs text-muted-foreground mb-1">Parti-Agent</div>
            <p>{currentRound.aiRebuttal}</p>
          </div>
        )}

        {typeof currentRound.judgeScore === "number" && (
          <div className="rounded-md border p-3">
            <div className="text-xs text-muted-foreground mb-1">Dommer</div>
            <p className="font-semibold">Score: {currentRound.judgeScore}</p>
            <p className="text-sm text-muted-foreground">{currentRound.judgeNotes}</p>
          </div>
        )}
      </main>

      {!over ? (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
          className="mt-6 flex gap-2"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Dine motargumenter…"
            className="flex-1 rounded-md border px-3 py-2 bg-transparent"
            aria-label="Ditt svar"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
          >
            Send
          </button>
        </form>
      ) : (
        <div className="mt-6">
          <a
            href="/resultat"
            className="px-4 py-2 rounded-md bg-black text-white inline-block dark:bg-white dark:text-black"
          >
            Se resultat
          </a>
        </div>
      )}
    </div>
  );
}

