"use client";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Topic = "klima" | "skatt" | "skole" | "helse" | "innvandring" | "miljø";
export type Party = "Ap" | "H" | "FrP" | "SV" | "MDG" | "Sp" | "R" | "V" | "KrF";

export interface RoundState {
  index: number; // 1..3
  aiOpening?: string;
  userReply?: string;
  aiRebuttal?: string;
  judgeScore?: number;
  judgeNotes?: string;
  openingCitations?: Array<{ id: string; source_url?: string; party?: string; year?: string; page?: number; excerpt?: string }>;
  rebuttalCitations?: Array<{ id: string; source_url?: string; party?: string; year?: string; page?: number; excerpt?: string }>;
}

interface DebateState {
  sessionId?: string;
  anonHandle?: string;
  topic?: Topic;
  party?: Party;
  rounds: RoundState[];
  activeIndex: number; // 1..3
  totalScore?: number;
  setSelection: (topic: Topic, party: Party) => void;
  setSession: (sessionId: string, anonHandle: string) => void;
  setRound: (idx: number, data: Partial<RoundState>) => void;
  setActive: (idx: number) => void;
  nextRound: () => void;
  setTotal: (score: number) => void;
  reset: () => void;
}

export const useDebateStore = create<DebateState>()(
  persist(
    (set, get) => ({
      rounds: [{ index: 1 }, { index: 2 }, { index: 3 }],
      activeIndex: 1,
      setSelection: (topic, party) => set({ topic, party }),
      setSession: (sessionId, anonHandle) => set({ sessionId, anonHandle }),
      setRound: (idx, data) =>
        set((s) => ({
          rounds: s.rounds.map((r) => (r.index === idx ? { ...r, ...data } : r)),
        })),
      setActive: (idx) => set({ activeIndex: Math.min(3, Math.max(1, idx)) }),
      nextRound: () => set({ activeIndex: Math.min(3, get().activeIndex + 1) }),
      setTotal: (score) => set({ totalScore: score }),
      reset: () =>
        set({ sessionId: undefined, anonHandle: undefined, rounds: [{ index: 1 }, { index: 2 }, { index: 3 }], activeIndex: 1, totalScore: undefined }),
    }),
    { name: "valgagenten-debate" }
  )
);
