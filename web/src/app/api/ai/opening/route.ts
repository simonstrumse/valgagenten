import { NextRequest, NextResponse } from "next/server";
import { ragSearch } from "@/lib/rag";
import { buildPartyAgentMessages } from "@/lib/prompts";
import { openai } from "@/lib/openai";

const topicSuggestions: Record<string, string[]> = {
  skatt: [
    "Hva mener dere om formuesskatten?",
    "Hvordan påvirkes vanlige lønnsmottakere?",
    "Skatt på bedrifter vs. investeringer?",
  ],
  klima: [
    "Karbonavgift eller andre virkemidler?",
    "Hva med omstilling i industrien?",
    "Internasjonalt samarbeid vs. nasjonale kutt?",
  ],
  skole: [
    "Flere lærere eller mer testing?",
    "Spesialundervisning og ressurser?",
    "Lekser og vurderingsformer?",
  ],
  helse: [
    "Ventetider og fastlegeordningen?",
    "Psykisk helse prioriteringer?",
    "Forebygging vs. behandling?",
  ],
  innvandring: [
    "Asylkriterier og integrering?",
    "Familiegjenforening?",
    "Arbeidsinnvandring vs. humanitære hensyn?",
  ],
  miljø: [
    "Vern av natur og arealbruk?",
    "Transport og arealplanlegging?",
    "Kraftutbygging vs. naturhensyn?",
  ],
};

export async function POST(req: NextRequest) {
  const { topic, party } = await req.json();
  if (!topic || !party) return NextResponse.json({ error: "Missing topic/party" }, { status: 400 });

  const { context, citations } = await ragSearch({ party, topic, k: 6 });
  const messages = buildPartyAgentMessages({ party, topic, context, task: "opening", suggestions: topicSuggestions[topic as string] });
  const ai = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    max_tokens: 220,
    temperature: 0.5,
  });
  const text = ai.choices?.[0]?.message?.content ?? "";
  const base = topicSuggestions[topic as string] || [
    "Kan du presisere hovedmålet i politikken?",
    "Hvilke tiltak prioriteres først?",
    "Hva er kompromisser dere er åpne for?",
  ];
  const suggestions = [
    ...base,
    `Fortell kort hva som er viktig for deg i ${topic} (1 setning)`,
  ];
  return NextResponse.json({ text, citations, suggestions });
}
