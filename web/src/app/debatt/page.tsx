"use client";
import { useEffect, useMemo, useState } from "react";
import { useDebateStore } from "@/store/useDebateStore";
import { MicButton } from "@/components/MicButton";
import { TTSButton } from "@/components/TTSButton";

export default function DebatePage() {
  const { topic, party, sessionId, rounds, setRound, activeIndex, nextRound } = useDebateStore();
  const [input, setInput] = useState("");
  const currentRound = useMemo(() => rounds.find((r) => r.index === activeIndex) ?? rounds[0], [rounds, activeIndex]);
  const [loading, setLoading] = useState(false);
  const [openingLoading, setOpeningLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    // Fetch opening argument for the active round if missing
    const run = async () => {
      if (!sessionId || !topic || !party) return;
      if (!currentRound.aiOpening) {
        setOpeningLoading(true);
        try {
          const res = await fetch("/api/ai/opening", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sessionId, topic, party, round: currentRound.index }),
          });
          const data = await res.json();
          setRound(currentRound.index, { aiOpening: data.text ?? "", openingCitations: data.citations || [] });
          if (Array.isArray(data.suggestions)) setSuggestions(data.suggestions);
        } catch (e) {
          console.error(e);
        } finally {
          setOpeningLoading(false);
        }
      }
    };
    run();
  }, [sessionId, topic, party, currentRound.index]);

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
      setRound(currentRound.index, { aiRebuttal: rebut.text ?? "", rebuttalCitations: rebut.citations || [] });
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
        {openingLoading && (
          <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-900/40" aria-busy="true" aria-live="polite">
            <div className="text-xs text-muted-foreground mb-1">Parti-Agent</div>
            <p>Laster inn innledning…</p>
          </div>
        )}
        {currentRound.aiOpening && (
          <div className="rounded-md border p-3 bg-gray-50 dark:bg-gray-900/40" aria-live="polite">
            <div className="text-xs text-muted-foreground mb-1">Parti-Agent</div>
            <p className="mb-2">{currentRound.aiOpening}</p>
            <div className="flex items-center justify-between">
              <TTSButton text={currentRound.aiOpening} />
            </div>
            {currentRound.openingCitations?.length ? (
              <ol className="mt-2 text-xs text-muted-foreground list-decimal list-inside">
                {currentRound.openingCitations.map((c, i) => (
                  <li key={`${c.id}-${i}`}>
                    {[c.party, c.year ? ` ${c.year}` : ""].filter(Boolean).join(",")}
                    {c.page ? ` – s. ${c.page}` : ""}
                    {" "}
                    {c.source_url ? (
                      <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">
                        kilde
                      </a>
                    ) : null}
                    {c.excerpt ? <span className="block opacity-80">“{c.excerpt.slice(0, 140)}{c.excerpt.length > 140 ? "…" : ""}”</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => setInput(s)}
                    className="px-2 py-1 rounded-full border text-xs hover:bg-black/5 dark:hover:bg-white/10"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
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
            <p className="mb-2">{currentRound.aiRebuttal}</p>
            <TTSButton text={currentRound.aiRebuttal} />
            {currentRound.rebuttalCitations?.length ? (
              <ol className="mt-2 text-xs text-muted-foreground list-decimal list-inside">
                {currentRound.rebuttalCitations.map((c, i) => (
                  <li key={`${c.id}-${i}`}>
                    {[c.party, c.year ? ` ${c.year}` : ""].filter(Boolean).join(",")}
                    {c.page ? ` – s. ${c.page}` : ""}
                    {" "}
                    {c.source_url ? (
                      <a className="underline" href={c.source_url} target="_blank" rel="noreferrer">
                        kilde
                      </a>
                    ) : null}
                    {c.excerpt ? <span className="block opacity-80">“{c.excerpt.slice(0, 140)}{c.excerpt.length > 140 ? "…" : ""}”</span> : null}
                  </li>
                ))}
              </ol>
            ) : null}
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
            disabled={!currentRound.aiOpening || openingLoading}
          />
          <MicButton onText={(t) => setInput((prev) => (prev ? prev + " " + t : t))} />
          <button
            type="submit"
            disabled={loading || !input.trim() || openingLoading}
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

      {!over && typeof currentRound.judgeScore === "number" && activeIndex < 3 && (
        <div className="mt-4">
          <button
            onClick={() => {
              setSuggestions([]);
              nextRound();
            }}
            className="px-4 py-2 rounded-md border"
          >
            Neste runde
          </button>
        </div>
      )}
    </div>
  );
}
