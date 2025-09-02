"use client";
import { useMemo } from "react";
import Link from "next/link";
import { useDebateStore } from "@/store/useDebateStore";

export default function ResultPage() {
  const { rounds, topic, party } = useDebateStore();
  const total = useMemo(() => rounds.reduce((s, r) => s + (r.judgeScore ?? 0), 0), [rounds]);
  const verdict = total >= 12 ? "sterk motargumentasjon" : total >= 9 ? "du holdt godt stand" : "parti-agenten overbeviste";

  return (
    <div className="min-h-screen px-6 py-8 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Resultat</h1>
      <p className="mb-6">
        Tema: <b>{topic}</b> · Parti: <b>{party}</b>
      </p>
      <div className="rounded-md border p-4 mb-6">
        <div className="text-sm text-muted-foreground">Totalscore</div>
        <div className="text-3xl font-bold">{total}/15</div>
        <div className="mt-1">{verdict}</div>
      </div>
      <div className="space-y-3">
        {rounds.map((r) => (
          <div key={r.index} className="rounded-md border p-3">
            <div className="font-semibold">Runde {r.index}</div>
            <div className="text-sm">Score: {r.judgeScore ?? "–"}</div>
            <div className="text-sm text-muted-foreground">{r.judgeNotes}</div>
          </div>
        ))}
      </div>
      <div className="mt-8">
        <label className="text-sm text-muted-foreground">Delbar tekst</label>
        <textarea
          className="w-full rounded-md border p-2 mt-1"
          rows={3}
          readOnly
          value={`Debatt mot ${party} om ${topic} – score ${total}/15.\nBeste runde: ${rounds.find((r)=>r.judgeNotes)?.judgeNotes ?? ""}.\nTest Valgagenten: valgagenten.no`}
        />
      </div>
      <div className="mt-6 flex gap-2">
        <Link className="px-4 py-2 rounded-md border" href="/">Spill igjen</Link>
        <Link className="px-4 py-2 rounded-md border" href="/toppliste">Se toppliste</Link>
      </div>
    </div>
  );
}
