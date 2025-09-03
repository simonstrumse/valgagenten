"use client";
import { useEffect, useState } from "react";
import { useChatStore } from "@/store/useChatStore";

export default function ResultPage() {
  const { conversationId } = useChatStore();
  const [res, setRes] = useState<any>(null);
  useEffect(() => {
    const run = async () => {
      const r = await fetch(`/api/match/compute`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ conversationId }) }).then((r) => r.json());
      setRes(r);
    };
    run();
  }, [conversationId]);

  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-4">Samsvar</h1>
      {!res ? (
        <div>Laster …</div>
      ) : (
        <div className="space-y-4">
          {res.top?.map((p: any) => (
            <div key={p.party} className="rounded-md border p-3">
              <div className="font-semibold">{p.party} — {Math.round(p.score * 100)}/100</div>
              <div className="text-sm mt-1">Hvorfor: {p.why?.join(" • ")}</div>
              {p.disagree?.length ? <div className="text-sm mt-1">Avvik: {p.disagree.join(" • ")}</div> : null}
              {p.citations?.length ? (
                <ol className="mt-2 text-xs text-muted-foreground list-decimal list-inside">
                  {p.citations.map((c: any, i: number) => (
                    <li key={`${c.id}-${i}`}>
                      {[c.party, c.year ? ` ${c.year}` : ""].filter(Boolean).join(",")} {c.page ? `– s. ${c.page}` : ""} {" "}
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
          ))}
        </div>
      )}
    </div>
  );
}

