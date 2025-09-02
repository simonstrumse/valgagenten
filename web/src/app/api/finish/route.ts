import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { sessionId, totalScore } = await req.json();
  if (!sessionId || typeof totalScore !== "number") return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  try {
    if (process.env.DATABASE_URL) {
      const s = await prisma.session.update({ where: { id: sessionId }, data: { totalScore } });
      await prisma.leaderboard.create({ data: { sessionId: s.id, totalScore } });
      return NextResponse.json({ ok: true });
    }
  } catch (e) {
    console.error(e);
  }
  return NextResponse.json({ ok: true });
}

