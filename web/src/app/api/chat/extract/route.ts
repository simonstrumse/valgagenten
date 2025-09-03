import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { CHATTOMATEN_CLAIMS } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: CHATTOMATEN_CLAIMS },
      { role: "user", content: text || "" },
    ];
    const res = await client.chat.completions.create({ model: process.env.OPENAI_MODEL_MATCH || "gpt-4o-mini", messages, max_tokens: 250, temperature: 0 });
    const out = res.choices?.[0]?.message?.content ?? "{}";
    let json: any;
    try { json = JSON.parse(out); } catch { json = { claims: [] }; }
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ claims: [], error: e?.message || "extract error" }, { status: 200 });
  }
}

