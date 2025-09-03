import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export async function POST(req: NextRequest) {
  try {
    const { messages, profile } = await req.json();
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const prompt: ChatCompletionMessageParam[] = [
      { role: "system", content: "Oppsummer kort (2-3 setninger) hva brukeren er opptatt av, på norsk. Returner JSON: {\"summary\": string, \"topicWeights\": { <tema>: number } }. Temaer typisk: klima, skatt, skole, helse, innvandring, utenriks, energi. Vekter 0..1. Ikke gi råd om hvem man bør stemme på." },
      { role: "user", content: `Meldinger: ${JSON.stringify(messages).slice(0, 8000)}\nProfil: ${JSON.stringify(profile)}` },
    ];
    const res = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL_MATCH || "gpt-4o-mini", messages: prompt, max_tokens: 220, temperature: 0 });
    const text = res.choices?.[0]?.message?.content ?? "{}";
    let json: any;
    try { json = JSON.parse(text); } catch { json = { summary: text.slice(0, 300), topicWeights: {} }; }
    return NextResponse.json(json);
  } catch (e: any) {
    return NextResponse.json({ summary: "", topicWeights: {}, error: e?.message || "summary error" }, { status: 200 });
  }
}
