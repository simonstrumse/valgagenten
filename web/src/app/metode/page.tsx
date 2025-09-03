export default function MethodPage() {
  return (
    <div className="min-h-screen max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-2">Metode</h1>
      <p className="text-sm text-muted-foreground mb-4">Transparens om datakilder, matching og begrensninger.</p>
      <ul className="list-disc pl-5 space-y-1 text-sm">
        <li>RAG: Hybrid leksikalsk+vektor, MMR for variasjon.</li>
        <li>Profiler: Centroid per parti×tema fra partiprogrammer.</li>
        <li>Bruker: Løpende oppsummering + tema-vekter (LLM).</li>
        <li>Score: Σ w_t * cos(user_t, parti_t), normalisert til 0–100.</li>
        <li>Kilder: Siterte utdrag med parti, år og URL.</li>
        <li>Ingen stemmeråd, kun informativ samsvarsanalyse.</li>
      </ul>
    </div>
  );
}

