import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";
import { CHATTOMATEN_PROFILE } from "@/lib/prompts";
import { ragSearch } from "@/lib/rag";

export async function POST(req: NextRequest) {
  try {
    const { parties, topics } = await req.json();
    const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const result: Record<string, any> = {};
    for (const party of parties || []) {
      result[party] = {};
      for (const topic of topics || []) {
        const { context, citations } = await ragSearch({ party, topic, k: 6 });
        const messages: ChatCompletionMessageParam[] = [
          { role: "system", content: CHATTOMATEN_PROFILE },
          { role: "user", content: `Utdrag for ${party} om ${topic}:\n${context}` },
        ];
        const res = await client.chat.completions.create({ model: process.env.OPENAI_MODEL_MATCH || "gpt-4o-mini", messages, max_tokens: 280, temperature: 0 });
        let json: any = {};
        try { json = JSON.parse(res.choices?.[0]?.message?.content || "{}"); } catch {}
        result[party][topic] = { ...(json?.topicProfiles?.[topic] || {}), citations };
      }
    }
    return NextResponse.json({ profiles: result });
  } catch (e: any) {
    return NextResponse.json({ profiles: {}, error: e?.message || "profiles error" }, { status: 200 });
  }
}

