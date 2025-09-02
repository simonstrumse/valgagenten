import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const range = (new URL(req.url).searchParams.get("range") || "7") as "7" | "30" | "all";
  try {
    if (process.env.DATABASE_URL) {
      const since =
        range === "all" ? undefined : new Date(Date.now() - Number(range) * 24 * 60 * 60 * 1000);
      const items = await prisma.leaderboard.findMany({
        where: since ? { createdAt: { gte: since } } : undefined,
        orderBy: { totalScore: "desc" },
        take: 10,
      });
      const sessions = await prisma.session.findMany({
        where: { id: { in: items.map((i: { sessionId: string }) => i.sessionId) } },
        select: { id: true, anonHandle: true },
      });
      const map = Object.fromEntries(sessions.map((s: { id: string; anonHandle: string }) => [s.id, s.anonHandle] as const));
      return NextResponse.json({
        items: items.map((i: { sessionId: string } & Record<string, any>) => ({ ...i, anonHandle: map[i.sessionId] })),
      });
    }
  } catch (e) {
    console.error(e);
  }
  // Fallback mocked list
  return NextResponse.json({
    items: [
      { sessionId: "mock1", anonHandle: "Debattant#1234", totalScore: 12, createdAt: new Date().toISOString() },
      { sessionId: "mock2", anonHandle: "Debattant#5678", totalScore: 10, createdAt: new Date().toISOString() },
    ],
  });
}
