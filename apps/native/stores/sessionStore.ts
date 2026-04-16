import { create } from "zustand";

type AnswerState = "idle" | "correct" | "wrong";

interface SessionStore {
  currentQuestionIndex: number;
  selectedOptionIndex: number | null;
  answerState: AnswerState;
  livesRemaining: number;
  actions: {
    selectOption: (index: number) => void;
    setAnswerState: (state: AnswerState) => void;
    setLivesRemaining: (lives: number) => void;
    nextQuestion: () => void;
    reset: (initialLives: number) => void;
  };
}

const INITIAL_STATE = {
  currentQuestionIndex: 0,
  selectedOptionIndex: null,
  answerState: "idle" as const,
  livesRemaining: 5,
};

export const useSessionStore = create<SessionStore>((set) => ({
  ...INITIAL_STATE,
  actions: {
    selectOption: (index) =>
      set({ selectedOptionIndex: index, answerState: "idle" }),
    setAnswerState: (state) => set({ answerState: state }),
    setLivesRemaining: (lives) => set({ livesRemaining: lives }),
    nextQuestion: () =>
      set((s) => ({
        currentQuestionIndex: s.currentQuestionIndex + 1,
        selectedOptionIndex: null,
        answerState: "idle",
      })),
    reset: (initialLives) =>
      set({ ...INITIAL_STATE, livesRemaining: initialLives }),
  },
}));
