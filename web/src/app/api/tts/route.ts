import { NextResponse } from "next/server";

export async function POST() {
  // Placeholder: return 501 until ElevenLabs integration is added
  return NextResponse.json({ error: "TTS ikke aktivert ennå" }, { status: 501 });
}
