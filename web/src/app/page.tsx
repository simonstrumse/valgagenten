"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useDebateStore, Party, Topic } from "@/store/useDebateStore";

const topics: Topic[] = ["klima", "skatt", "skole", "helse", "innvandring", "miljø"];
const parties: Party[] = ["Ap", "H", "FrP", "SV", "MDG", "Sp", "R", "V", "KrF"];

export default function Home() {
  const router = useRouter();
  const setSelection = useDebateStore((s) => s.setSelection);
  const [topic, setTopic] = useState<Topic | undefined>();
  const [party, setParty] = useState<Party | undefined>();
  const [loading, setLoading] = useState(false);

  const start = async () => {
    if (!topic || !party) return;
    setSelection(topic, party);
    setLoading(true);
    try {
      const res = await fetch("/api/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, party }),
      });
      const data = await res.json();
      if (data?.sessionId) {
        useDebateStore.getState().setSession(data.sessionId, data.anonHandle ?? "Debattant");
        router.push("/debatt");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Valgagenten – tren på saklig debatt</h1>
        <p className="text-muted-foreground mt-2">Velg tema og parti for å starte.</p>
      </header>

      <section className="mb-8">
        <h2 className="font-semibold mb-2">Tema</h2>
        <div className="flex flex-wrap gap-2">
          {topics.map((t) => (
            <button
              key={t}
              onClick={() => setTopic(t)}
              className={`px-3 py-1 rounded-full border text-sm ${
                topic === t ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
              aria-pressed={topic === t}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <h2 className="font-semibold mb-2">Parti</h2>
        <div className="flex flex-wrap gap-2">
          {parties.map((p) => (
            <button
              key={p}
              onClick={() => setParty(p)}
              className={`px-3 py-1 rounded-full border text-sm ${
                party === p ? "bg-black text-white dark:bg-white dark:text-black" : "hover:bg-black/5 dark:hover:bg-white/10"
              }`}
              aria-pressed={party === p}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <button
        onClick={start}
        disabled={!topic || !party || loading}
        className="px-4 py-2 rounded-md bg-black text-white disabled:opacity-50 dark:bg-white dark:text-black"
      >
        {loading ? "Starter…" : "Start debatt"}
      </button>

      <footer className="mt-16 text-sm text-muted-foreground">
        <a className="underline" href="/personvern">Personvern</a> · {" "}
        <a className="underline" href="/vilkår">Vilkår</a>
      </footer>
    </div>
  );
}
