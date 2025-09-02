import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const { topic, party } = await req.json();
  if (!topic || !party) return NextResponse.json({ error: "Missing topic/party" }, { status: 400 });
  const anonHandle = `Debattant#${Math.floor(1000 + Math.random() * 9000)}`;
  const useDb = !!process.env.DATABASE_URL;
  try {
    if (useDb) {
      const s = await prisma.session.create({ data: { topic, party, anonHandle } });
      return NextResponse.json({ sessionId: s.id, anonHandle: s.anonHandle });
    }
  } catch (e) {
    console.error("DB error", e);
  }
  // Fallback mock
  const sessionId = crypto.randomUUID();
  return NextResponse.json({ sessionId, anonHandle });
}

