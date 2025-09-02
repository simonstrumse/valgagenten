type LeaderItem = { sessionId: string; anonHandle: string; totalScore: number; createdAt: string };

async function getLeaderboard(range: "7" | "30" | "all" = "7") {
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ""}/api/leaderboard?range=${range}`, {
    cache: "no-store",
  });
  return res.json();
}

export default async function LeaderboardPage({ searchParams }: { searchParams: { range?: string } }) {
  const range = (searchParams?.range as "7" | "30" | "all") || "7";
  const data = await getLeaderboard(range);
  return (
    <div className="min-h-screen px-6 py-8 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Toppliste</h1>
      <div className="mb-4 flex gap-2">
        <a className={`px-3 py-1 rounded-full border text-sm ${range === "7" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`} href="/toppliste?range=7">Uke</a>
        <a className={`px-3 py-1 rounded-full border text-sm ${range === "30" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`} href="/toppliste?range=30">Måned</a>
        <a className={`px-3 py-1 rounded-full border text-sm ${range === "all" ? "bg-black text-white dark:bg-white dark:text-black" : ""}`} href="/toppliste?range=all">All time</a>
      </div>
      <table className="w-full text-left border rounded-md overflow-hidden">
        <thead className="bg-gray-50 dark:bg-gray-900/40">
          <tr>
            <th className="p-2">Plass</th>
            <th className="p-2">Bruker</th>
            <th className="p-2">Score</th>
            <th className="p-2">Dato</th>
          </tr>
        </thead>
        <tbody>
          {data?.items?.map((row: LeaderItem, i: number) => (
            <tr key={row.sessionId} className="border-t">
              <td className="p-2">{i + 1}</td>
              <td className="p-2">{row.anonHandle}</td>
              <td className="p-2">{row.totalScore}</td>
              <td className="p-2">{new Date(row.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
