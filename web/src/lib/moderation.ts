import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function moderateText(input: string): Promise<{ flagged: boolean; categories?: any }> {
  try {
    const res = await client.moderations.create({ model: "omni-moderation-latest", input });
    const r = (res as any).results?.[0];
    return { flagged: !!r?.flagged, categories: r?.categories };
  } catch (e) {
    return { flagged: false };
  }
}

