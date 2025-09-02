export function ScoreCard({ round, score, notes }: { round: number; score?: number; notes?: string }) {
  return (
    <div className="rounded-md border p-3">
      <div className="font-semibold">Runde {round}</div>
      <div className="text-sm">Score: {typeof score === "number" ? score : "–"}</div>
      <div className="text-sm text-muted-foreground">{notes}</div>
    </div>
  );
}

