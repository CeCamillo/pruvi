import type { PublicQuestion } from "@pruvi/shared/sessions";

export type QuizPhase = "answering" | "checking" | "feedback" | "complete";

export type QuizState = {
  phase: QuizPhase;
  questions: PublicQuestion[];
  currentIndex: number;
  selectedIndex: number | null;
  lastAnswerCorrect: boolean | null;
  correctCount: number;
  answeredCount: number;
};

export type QuizAction =
  | { type: "LOAD_QUESTIONS"; questions: PublicQuestion[] }
  | { type: "SELECT_ANSWER"; selectedIndex: number }
  | { type: "SUBMIT_ANSWER"; correctOptionIndex: number }
  | { type: "NEXT_QUESTION" }
  | { type: "RESET" };

export const initialQuizState: QuizState = {
  phase: "answering",
  questions: [],
  currentIndex: 0,
  selectedIndex: null,
  lastAnswerCorrect: null,
  correctCount: 0,
  answeredCount: 0,
};

export function quizReducer(state: QuizState, action: QuizAction): QuizState {
  switch (action.type) {
    case "LOAD_QUESTIONS":
      return { ...initialQuizState, questions: action.questions };

    case "SELECT_ANSWER":
      if (state.phase !== "answering") return state;
      return { ...state, phase: "checking", selectedIndex: action.selectedIndex };

    case "SUBMIT_ANSWER": {
      if (state.phase !== "checking" || state.selectedIndex === null) return state;
      const correct = state.selectedIndex === action.correctOptionIndex;
      return {
        ...state,
        phase: "feedback",
        lastAnswerCorrect: correct,
        correctCount: correct ? state.correctCount + 1 : state.correctCount,
        answeredCount: state.answeredCount + 1,
      };
    }

    case "NEXT_QUESTION": {
      if (state.phase !== "feedback") return state;
      const isLast = state.currentIndex >= state.questions.length - 1;
      if (isLast) {
        return { ...state, phase: "complete" };
      }
      return {
        ...state,
        phase: "answering",
        currentIndex: state.currentIndex + 1,
        selectedIndex: null,
        lastAnswerCorrect: null,
      };
    }

    case "RESET":
      return initialQuizState;
  }
}
