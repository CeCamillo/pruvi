import { describe, it, expect } from "vitest";
import { quizReducer, initialQuizState } from "../quiz.reducer";
import type { QuizState, QuizAction } from "../quiz.reducer";

const makeQuestion = (id: number) => ({
  id,
  body: `Question ${id}`,
  options: ["Option A", "Option B", "Option C", "Option D"],
  difficulty: 1,
  source: null,
  subjectId: 1,
  createdAt: new Date().toISOString(),
});

const questions = [makeQuestion(1), makeQuestion(2), makeQuestion(3)];

function reduce(state: QuizState, action: QuizAction): QuizState {
  return quizReducer(state, action);
}

describe("quizReducer", () => {
  it("starts in answering state", () => {
    expect(initialQuizState.phase).toBe("answering");
  });

  it("SELECT_ANSWER transitions to checking phase", () => {
    const state: QuizState = { ...initialQuizState, questions, currentIndex: 0 };
    const next = reduce(state, { type: "SELECT_ANSWER", selectedIndex: 1 });
    expect(next.phase).toBe("checking");
    expect(next.selectedIndex).toBe(1);
  });

  it("SUBMIT_ANSWER transitions to feedback phase and records correctness", () => {
    const state: QuizState = {
      ...initialQuizState,
      questions,
      currentIndex: 0,
      phase: "checking",
      selectedIndex: 0,
    };
    // correctOptionIndex=0 → correct
    const next = reduce(state, { type: "SUBMIT_ANSWER", correctOptionIndex: 0 });
    expect(next.phase).toBe("feedback");
    expect(next.lastAnswerCorrect).toBe(true);
  });

  it("SUBMIT_ANSWER marks incorrect when wrong option selected", () => {
    const state: QuizState = {
      ...initialQuizState,
      questions,
      currentIndex: 0,
      phase: "checking",
      selectedIndex: 2,
    };
    const next = reduce(state, { type: "SUBMIT_ANSWER", correctOptionIndex: 0 });
    expect(next.lastAnswerCorrect).toBe(false);
  });

  it("NEXT_QUESTION advances index and returns to answering", () => {
    const state: QuizState = {
      ...initialQuizState,
      questions,
      currentIndex: 0,
      phase: "feedback",
    };
    const next = reduce(state, { type: "NEXT_QUESTION" });
    expect(next.currentIndex).toBe(1);
    expect(next.phase).toBe("answering");
    expect(next.selectedIndex).toBeNull();
  });

  it("NEXT_QUESTION on last question transitions to complete", () => {
    const state: QuizState = {
      ...initialQuizState,
      questions,
      currentIndex: 2, // last index
      phase: "feedback",
      correctCount: 2,
      answeredCount: 2,
    };
    const next = reduce(state, { type: "NEXT_QUESTION" });
    expect(next.phase).toBe("complete");
  });

  it("SUBMIT_ANSWER increments correctCount only when correct", () => {
    const base: QuizState = {
      ...initialQuizState,
      questions,
      currentIndex: 0,
      phase: "checking",
      selectedIndex: 0,
    };
    const correct = reduce(base, { type: "SUBMIT_ANSWER", correctOptionIndex: 0 });
    expect(correct.correctCount).toBe(1);
    expect(correct.answeredCount).toBe(1);

    const wrong = reduce(
      { ...base, selectedIndex: 1 },
      { type: "SUBMIT_ANSWER", correctOptionIndex: 0 },
    );
    expect(wrong.correctCount).toBe(0);
    expect(wrong.answeredCount).toBe(1);
  });

  it("LOAD_QUESTIONS initialises state with questions in answering phase", () => {
    const next = reduce(initialQuizState, { type: "LOAD_QUESTIONS", questions });
    expect(next.questions).toHaveLength(3);
    expect(next.phase).toBe("answering");
    expect(next.currentIndex).toBe(0);
  });

  it("RESET returns to initial state", () => {
    const modified: QuizState = {
      ...initialQuizState,
      questions,
      currentIndex: 2,
      phase: "complete",
      correctCount: 3,
    };
    const next = reduce(modified, { type: "RESET" });
    expect(next).toEqual(initialQuizState);
  });
});
