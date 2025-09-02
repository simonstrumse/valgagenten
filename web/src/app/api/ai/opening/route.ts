import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { topic, party } = await req.json();
  if (!topic || !party) return NextResponse.json({ error: "Missing topic/party" }, { status: 400 });

  // Placeholder without LLM call to keep skeleton working
  const text = `(${party}) Innledende argument om ${topic}: Vi vil gjerne skissere en balansert tilnærming. [KILDE: Parti, År]`;
  return NextResponse.json({ text, citations: [] });
}
