import { NextRequest, NextResponse } from "next/server";
import { buildJudgeMessages, parseJudgeResponse } from "@/lib/prompts";
import { openai } from "@/lib/openai";
import { moderateText } from "@/lib/moderation";

export async function POST(req: NextRequest) {
  const { userText, aiText, topic, party } = await req.json();
  if (!userText || !aiText || !topic || !party) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const mod = await moderateText(userText);
  if (mod.flagged) {
    return NextResponse.json({ score: 1, rationale: "Innholdet bryter retningslinjer (moderering). Formuler argumentet saklig." });
  }
  const messages = buildJudgeMessages({ userText, aiText, topic, party });
  const ai = await openai.chat.completions.create({ model: "gpt-4o-mini", messages, max_tokens: 200, temperature: 0 });
  const raw = ai.choices?.[0]?.message?.content ?? "";
  const { score, rationale } = parseJudgeResponse(raw);
  return NextResponse.json({ score, rationale });
}
