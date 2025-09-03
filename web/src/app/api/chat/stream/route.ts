import { NextRequest } from "next/server";
import { openai } from "@/lib/openai";
import { CHATTOMATEN_SECURITY, CHATTOMATEN_GUIDE } from "@/lib/prompts";
import type { ChatCompletionMessageParam } from "openai/resources/chat/completions";

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // using pg in other helpers would require node runtime

export async function POST(req: NextRequest) {
  const { conversationId, userMessage } = await req.json();
  const messages: ChatCompletionMessageParam[] = [
    { role: "system", content: `${CHATTOMATEN_SECURITY}\n\n${CHATTOMATEN_GUIDE}` },
    { role: "user", content: userMessage || "" },
  ];
  const stream = await openai.chat.completions.create({ model: process.env.OPENAI_MODEL_MATCH || "gpt-4o-mini", messages, stream: true, max_tokens: 250, temperature: 0.6 });

  const encoder = new TextEncoder();
  const rs = new ReadableStream({
    async start(controller) {
      try {
        for await (const part of stream) {
          const delta = part.choices?.[0]?.delta?.content || "";
          if (delta) controller.enqueue(encoder.encode(delta));
        }
        controller.close();
      } catch (e) {
        controller.error(e);
      }
    },
  });

  return new Response(rs, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}
