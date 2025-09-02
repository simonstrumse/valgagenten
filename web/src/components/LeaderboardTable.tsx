export function LeaderboardTable({ items }: { items: Array<{ sessionId: string; anonHandle: string; totalScore: number; createdAt: string }> }) {
  return (
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
        {items?.map((row, i) => (
          <tr key={row.sessionId} className="border-t">
            <td className="p-2">{i + 1}</td>
            <td className="p-2">{row.anonHandle}</td>
            <td className="p-2">{row.totalScore}</td>
            <td className="p-2">{new Date(row.createdAt).toLocaleDateString()}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

