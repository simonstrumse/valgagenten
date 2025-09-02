import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { userText, aiText } = await req.json();
  if (!userText || !aiText) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  // Simple deterministic mock scoring based on length
  const len = Math.min(userText.length, 400);
  const score = Math.max(1, Math.min(5, Math.round(len / 100)));
  const rationale =
    score >= 4
      ? "Tydelig problematisering med relevante eksempler. Kunne vært støttet av flere kilder."
      : score >= 3
      ? "Noen relevante poenger, men kunne vært mer presis og kildebasert."
      : "Begrenset relevans og struktur; utdyp med konkrete eksempler.";
  return NextResponse.json({ score, rationale });
}

