import { ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import type { QuestionsRepository } from "./questions.repository";

const DEFAULT_QUESTION_COUNT = 10;

export class QuestionsService {
  constructor(private repo: QuestionsRepository) {}

  /** Select questions for a session using SM-2 priority */
  async selectForSession(
    userId: string,
    mode: "all" | "theoretical",
    count: number = DEFAULT_QUESTION_COUNT
  ): Promise<
    Result<
      Awaited<ReturnType<QuestionsRepository["selectQuestions"]>>,
      AppError
    >
  > {
    const questions = await this.repo.selectQuestions(userId, count, mode);
    return ok(questions);
  }
}
