export default function Home() {
  return (
    <div className="min-h-screen px-6 py-12 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold">Velg app</h1>
        <p className="text-muted-foreground mt-2">To verktøy bygget på samme RAG-infrastruktur: tren debatt, eller utforsk samsvar via åpen chat.</p>
      </header>

      <div className="grid sm:grid-cols-2 gap-4">
        <a href="/valgagenten" className="block rounded-md border p-4 hover:bg-black/5 dark:hover:bg-white/10">
          <div className="font-semibold mb-1">Valgagenten</div>
          <p className="text-sm text-muted-foreground">Tren på saklig debatt mot en parti-agent over 3 runder. Dommer gir poeng. TTS/STT støttet.</p>
          <div className="mt-3 inline-block px-3 py-1 rounded-md border text-sm">Åpne</div>
        </a>
        <a href="/chat?new=1" className="block rounded-md border p-4 hover:bg-black/5 dark:hover:bg-white/10">
          <div className="font-semibold mb-1">Chattomaten</div>
          <p className="text-sm text-muted-foreground">Samtalebasert valgomat: klargjør hva som er viktig for deg og se tematisk samsvar mot partier – med kilder.</p>
          <div className="mt-3 inline-block px-3 py-1 rounded-md border text-sm">Åpne</div>
        </a>
      </div>

      <section className="mt-10">
        <h2 className="font-semibold mb-2">Hvordan funker det?</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-1">
          <li>RAG: Hybrid leksikalsk+vektor, MMR for variasjon. Kildeutdrag med parti/år/side.</li>
          <li>LLM: Rimelig, rask modell – uten stemmeråd, kun nøytral veiledning.</li>
          <li>Personvern: Anonym bruk; se /metode for transparens.</li>
        </ul>
        <div className="mt-3">
          <a className="underline text-sm" href="/metode">Les mer om metoden</a>
        </div>
      </section>

      <footer className="mt-16 text-sm text-muted-foreground">
        <a className="underline" href="/personvern">Personvern</a> · <a className="underline" href="/vilkår">Vilkår</a>
      </footer>
    </div>
  );
}
