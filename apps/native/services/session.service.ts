import {
  AnswerQuestionResponseSchema,
  LivesResponseSchema,
  StreakResponseSchema,
  XpResponseSchema,
  completeSessionResponseSchema,
  startSessionResponseSchema,
  todaySessionResponseSchema,
} from "@pruvi/shared";

import { apiRequest } from "@/lib/api-client";

const jsonHeaders = { "Content-Type": "application/json" };

export const sessionService = {
  getToday: () =>
    apiRequest("/sessions/today", { method: "GET" }, todaySessionResponseSchema),

  startSession: (mode: "all" | "theoretical") =>
    apiRequest(
      "/sessions/start",
      {
        method: "POST",
        body: JSON.stringify({ mode }),
        headers: jsonHeaders,
      },
      startSessionResponseSchema,
    ),

  completeSession: (id: number, questionCount: number, correctCount: number) =>
    apiRequest(
      `/sessions/${id}/complete`,
      {
        method: "POST",
        body: JSON.stringify({ questionCount, correctCount }),
        headers: jsonHeaders,
      },
      completeSessionResponseSchema,
    ),

  answerQuestion: (questionId: number, selectedOptionIndex: number) =>
    apiRequest(
      `/questions/${questionId}/answer`,
      {
        method: "POST",
        body: JSON.stringify({ selectedOptionIndex }),
        headers: jsonHeaders,
      },
      AnswerQuestionResponseSchema,
    ),

  getLives: () =>
    apiRequest("/users/me/lives", { method: "GET" }, LivesResponseSchema),

  getXp: () =>
    apiRequest("/users/me/xp", { method: "GET" }, XpResponseSchema),

  getStreaks: () =>
    apiRequest("/streaks", { method: "GET" }, StreakResponseSchema),
};
