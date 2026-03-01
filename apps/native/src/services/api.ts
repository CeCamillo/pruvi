import { env } from "@pruvi/env/native";
import { subjectWithCountSchema } from "@pruvi/shared/subjects";
import { startSessionResponseSchema, dailySessionSchema } from "@pruvi/shared/sessions";
import type { SubjectWithCount } from "@pruvi/shared/subjects";
import type { StartSessionResponse, DailySession } from "@pruvi/shared/sessions";

const BASE_URL = env.EXPO_PUBLIC_SERVER_URL;
const DEFAULT_HEADERS = {
  "Content-Type": "application/json",
  "X-User-Id": "local-tester",
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: DEFAULT_HEADERS,
  });
  if (!res.ok) {
    throw new Error(`API error ${res.status.toString()}: ${path}`);
  }
  return res.json() as Promise<T>;
}

export const api = {
  async getSubjects(): Promise<SubjectWithCount[]> {
    const data = await request<unknown>("/subjects");
    return subjectWithCountSchema.array().parse(data);
  },

  async startSession(count = 10): Promise<StartSessionResponse> {
    const data = await request<unknown>("/sessions/start", {
      method: "POST",
      body: JSON.stringify({ count }),
    });
    return startSessionResponseSchema.parse(data);
  },

  async completeSession(
    sessionId: number,
    params: { questionsAnswered: number; questionsCorrect: number },
  ): Promise<DailySession> {
    const data = await request<unknown>(`/sessions/${sessionId}/complete`, {
      method: "POST",
      body: JSON.stringify(params),
    });
    return dailySessionSchema.parse(data);
  },

  async answerQuestion(questionId: number, params: { selectedOptionIndex: number }): Promise<void> {
    await request<unknown>(`/questions/${questionId}/answer`, {
      method: "POST",
      body: JSON.stringify(params),
    });
  },
};
