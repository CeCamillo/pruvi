import type { Question } from "@pruvi/shared/questions";

let storedQuestions: Question[] = [];

export function setQuestions(questions: Question[]) {
  storedQuestions = questions;
}

export function getQuestions(): Question[] {
  return storedQuestions;
}
