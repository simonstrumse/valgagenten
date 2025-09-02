import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import { toFile } from "openai/uploads";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing audio file" }, { status: 400 });
    }
    const arrayBuffer = await file.arrayBuffer();
    const f = await toFile(Buffer.from(arrayBuffer), "audio.webm", { type: file.type || "audio/webm" });
    const tr = await openai.audio.transcriptions.create({ file: f, model: "whisper-1", response_format: "json" });
    const text = (tr as any)?.text || "";
    return NextResponse.json({ text });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "STT error" }, { status: 500 });
  }
}
