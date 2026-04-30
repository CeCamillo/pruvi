import { create } from "zustand";

type AnswerState = "idle" | "correct" | "wrong";

interface RoletaStore {
  currentIndex: number;
  selectedOptionIndex: number | null;
  answerState: AnswerState;
  correctCount: number;
  xpEarned: number;
  actions: {
    selectOption: (i: number) => void;
    setAnswerState: (s: AnswerState) => void;
    recordAnswer: (correct: boolean, xp: number) => void;
    nextQuestion: () => void;
    reset: () => void;
  };
}

const INITIAL = {
  currentIndex: 0,
  selectedOptionIndex: null as number | null,
  answerState: "idle" as AnswerState,
  correctCount: 0,
  xpEarned: 0,
};

export const useRoletaStore = create<RoletaStore>((set) => ({
  ...INITIAL,
  actions: {
    selectOption: (i) =>
      set({ selectedOptionIndex: i, answerState: "idle" }),
    setAnswerState: (s) => set({ answerState: s }),
    recordAnswer: (correct, xp) =>
      set((state) => ({
        correctCount: state.correctCount + (correct ? 1 : 0),
        xpEarned: state.xpEarned + xp,
      })),
    nextQuestion: () =>
      set((state) => ({
        currentIndex: state.currentIndex + 1,
        selectedOptionIndex: null,
        answerState: "idle",
      })),
    reset: () => set(INITIAL),
  },
}));

export const useRoletaActions = () => useRoletaStore((s) => s.actions);
