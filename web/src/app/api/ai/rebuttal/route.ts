import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { topic, party, userText } = await req.json();
  if (!topic || !party || !userText) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const text = `(${party}) Kort svar på dine innvendinger om ${topic}:\n- Punkt 1: Vi vektlegger helheten.\n- Punkt 2: Tiltak må være gjennomførbare.\n[Markerer usikkerhet der kildene er uklare]`;
  return NextResponse.json({ text });
}

