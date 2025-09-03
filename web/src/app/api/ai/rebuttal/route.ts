import { NextRequest, NextResponse } from "next/server";
import { ragSearch } from "@/lib/rag";
import { buildPartyAgentMessages } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import { moderateText } from "@/lib/moderation";

export async function POST(req: NextRequest) {
  const { topic, party, userText } = await req.json();
  if (!topic || !party || !userText) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const mod = await moderateText(userText);
  if (mod.flagged) {
    return NextResponse.json({
      text: "Jeg kan ikke svare på dette fordi innholdet bryter retningslinjene. Vennligst formuler argumentet saklig og uten hatefulle uttrykk.",
    });
  }
  const { context, citations } = await ragSearch({ party, topic, k: 6 });
  const messages = buildPartyAgentMessages({ party, topic, context, userText });
  const ai = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 220,
    temperature: 0.6,
  });
  const text = ai.choices?.[0]?.message?.content ?? "";
  return NextResponse.json({ text, citations });
}
