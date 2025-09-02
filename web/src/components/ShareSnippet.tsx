"use client";
import { useState } from "react";

export function ShareSnippet({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="flex items-center gap-2">
      <textarea readOnly className="flex-1 rounded-md border p-2" rows={3} value={text} />
      <button onClick={copy} className="px-3 py-2 rounded-md border">{copied ? "Kopiert" : "Kopier"}</button>
    </div>
  );
}

