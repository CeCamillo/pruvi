import { err, ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { SessionsRepository } from "./sessions.repository";

const DEFAULT_QUESTION_COUNT = 10;

export class SessionsService {
  constructor(private repo: SessionsRepository) {}

  /** Start or resume today's session */
  async startSession(
    userId: string,
    mode: "all" | "theoretical",
    skipQuestions = false
  ): Promise<
    Result<
      {
        session: Awaited<ReturnType<SessionsRepository["createSession"]>>;
        questions: Awaited<
          ReturnType<SessionsRepository["selectQuestions"]>
        >;
      },
      AppError
    >
  > {
    // Check if there's already an active session today
    const existing = await this.repo.findTodaySession(userId);
    if (existing && existing.status === "active") {
      // Resume: always fetch fresh questions (cache is for new sessions)
      const questions = await this.repo.selectQuestions(
        userId,
        DEFAULT_QUESTION_COUNT,
        mode
      );
      return ok({ session: existing, questions });
    }

    if (existing && existing.status === "completed") {
      return err(
        new ValidationError("You already completed today's session")
      );
    }

    // Create new session
    const session = await this.repo.createSession(userId);

    // Skip question selection if caller has cached questions
    const questions = skipQuestions
      ? []
      : await this.repo.selectQuestions(userId, DEFAULT_QUESTION_COUNT, mode);

    return ok({ session, questions });
  }

  /** Get today's session if it exists */
  async getTodaySession(
    userId: string
  ): Promise<
    Result<
      Awaited<ReturnType<SessionsRepository["findTodaySession"]>>,
      AppError
    >
  > {
    const session = await this.repo.findTodaySession(userId);
    return ok(session);
  }

  /** Complete a session */
  async completeSession(
    userId: string,
    sessionId: number,
    questionCount: number,
    correctCount: number
  ): Promise<
    Result<
      Awaited<ReturnType<SessionsRepository["completeSession"]>>,
      AppError
    >
  > {
    const session = await this.repo.findSessionById(sessionId);
    if (!session) {
      return err(new NotFoundError("Session not found"));
    }
    if (session.userId !== userId) {
      return err(new NotFoundError("Session not found"));
    }
    if (session.status === "completed") {
      return err(new ValidationError("Session already completed"));
    }

    const completed = await this.repo.completeSession(
      sessionId,
      questionCount,
      correctCount
    );
    return ok(completed);
  }
}
