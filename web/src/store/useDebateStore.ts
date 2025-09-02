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
}

interface DebateState {
  sessionId?: string;
  anonHandle?: string;
  topic?: Topic;
  party?: Party;
  rounds: RoundState[];
  totalScore?: number;
  setSelection: (topic: Topic, party: Party) => void;
  setSession: (sessionId: string, anonHandle: string) => void;
  setRound: (idx: number, data: Partial<RoundState>) => void;
  setTotal: (score: number) => void;
  reset: () => void;
}

export const useDebateStore = create<DebateState>()(
  persist(
    (set) => ({
      rounds: [{ index: 1 }, { index: 2 }, { index: 3 }],
      setSelection: (topic, party) => set({ topic, party }),
      setSession: (sessionId, anonHandle) => set({ sessionId, anonHandle }),
      setRound: (idx, data) =>
        set((s) => ({
          rounds: s.rounds.map((r) => (r.index === idx ? { ...r, ...data } : r)),
        })),
      setTotal: (score) => set({ totalScore: score }),
      reset: () =>
        set({ sessionId: undefined, anonHandle: undefined, rounds: [{ index: 1 }, { index: 2 }, { index: 3 }], totalScore: undefined }),
    }),
    { name: "valgagenten-debate" }
  )
);

