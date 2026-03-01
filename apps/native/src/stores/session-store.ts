import { create } from "zustand";
import type { DailySession, PublicQuestion } from "@pruvi/shared/sessions";

type SessionState = {
  sessionId: number | null;
  questions: PublicQuestion[];
  currentIndex: number;
  session: DailySession | null;
  setSession: (session: DailySession, questions: PublicQuestion[]) => void;
  clearSession: () => void;
};

export const useSessionStore = create<SessionState>((set) => ({
  sessionId: null,
  questions: [],
  currentIndex: 0,
  session: null,
  setSession: (session, questions) => {
    set({ sessionId: session.id, session, questions, currentIndex: 0 });
  },
  clearSession: () => {
    set({ sessionId: null, session: null, questions: [], currentIndex: 0 });
  },
}));
