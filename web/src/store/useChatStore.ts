"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

type Msg = { id?: string; role: "user" | "assistant" | "system"; content: string };

interface ChatState {
  conversationId?: string;
  profile?: { age?: number; municipality?: string; occupation?: string; concerns?: string };
  messages: Msg[];
  streaming: boolean;
  progress: number; // 0-100 heuristic
  summary?: string;
  topicWeights?: Record<string, number>;
  history: Array<{ id: string; timestamp: number; profile?: ChatState["profile"]; summary?: string; topicWeights?: Record<string, number>; messages: Msg[] }>;
  setConversation: (id: string) => void;
  addMessage: (m: Msg) => void;
  updateLastAssistant: (updater: (prev: string) => string) => void;
  setStreaming: (b: boolean) => void;
  setProfile: (p: Partial<ChatState["profile"]>) => void;
  setSummary: (s: string) => void;
  setTopicWeights: (w: Record<string, number>) => void;
  setProgress: (n: number) => void;
  saveCurrentToHistory: () => void;
  loadHistory: (id: string) => void;
  deleteHistory: (id: string) => void;
  reset: () => void;
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messages: [],
      streaming: false,
      progress: 0,
      summary: undefined,
      topicWeights: undefined,
      history: [],
      setConversation: (id) => set({ conversationId: id }),
      addMessage: (m) => set({ messages: [...get().messages, m] }),
      updateLastAssistant: (updater) =>
        set((s) => {
          const msgs = [...s.messages];
          for (let i = msgs.length - 1; i >= 0; i--) {
            if (msgs[i].role === "assistant") {
              msgs[i] = { ...msgs[i], content: updater(msgs[i].content) };
              break;
            }
          }
          return { messages: msgs };
        }),
      setStreaming: (b) => set({ streaming: b }),
      setProfile: (p) => set({ profile: { ...get().profile, ...p } }),
      setSummary: (s) => set({ summary: s }),
      setTopicWeights: (w) => set({ topicWeights: w }),
      setProgress: (n) => set({ progress: Math.max(0, Math.min(100, Math.round(n))) }),
      saveCurrentToHistory: () =>
        set((s) => {
          if (!s.messages.length) return {} as any;
          const id = `${Date.now()}`;
          const item = { id, timestamp: Date.now(), profile: s.profile, summary: s.summary, topicWeights: s.topicWeights, messages: s.messages };
          return { history: [item, ...s.history].slice(0, 20) };
        }),
      loadHistory: (id) =>
        set((s) => {
          const h = s.history.find((x) => x.id === id);
          if (!h) return {} as any;
          return { messages: h.messages, profile: h.profile, summary: h.summary, topicWeights: h.topicWeights, progress: 50 };
        }),
      deleteHistory: (id) => set((s) => ({ history: s.history.filter((x) => x.id !== id) })),
      reset: () => set({ conversationId: undefined, messages: [], streaming: false, progress: 0, profile: {} }),
    }),
    { name: "valgagenten-chattomaten" }
  )
);
