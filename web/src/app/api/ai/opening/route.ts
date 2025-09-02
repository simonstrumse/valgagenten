import { NextRequest, NextResponse } from "next/server";
import { ragSearch } from "@/lib/rag";
import { buildPartyAgentMessages } from "@/lib/prompts";
import { openai } from "@/lib/openai";

export async function POST(req: NextRequest) {
  const { topic, party } = await req.json();
  if (!topic || !party) return NextResponse.json({ error: "Missing topic/party" }, { status: 400 });

  const { context, citations } = await ragSearch({ party, topic, k: 6 });
  const messages = buildPartyAgentMessages({ party, topic, context });
  const ai = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 220,
    temperature: 0.5,
  });
  const text = ai.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ text, citations });
}
