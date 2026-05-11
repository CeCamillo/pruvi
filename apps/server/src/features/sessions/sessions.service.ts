import { err, ok, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { SessionsRepository } from "./sessions.repository";
import type { QuestionsService } from "../questions/questions.service";
import type { TopicsService } from "../topics/topics.service";

type SessionRow = NonNullable<Awaited<ReturnType<SessionsRepository["findTodaySession"]>>>;
type QuestionItem = { id: number; subtopicId: number; [key: string]: unknown };

export class SessionsService {
  constructor(
    private repo: SessionsRepository,
    private questionsService: QuestionsService,
    private topicsService: TopicsService,
  ) {}

  /** Start or resume today's session */
  async startSession(
    userId: string,
    mode: "all" | "theoretical",
    skipQuestions = false,
    topicId?: number,
  ): Promise<
    Result<
      {
        session: SessionRow;
        questions: QuestionItem[];
      },
      AppError
    >
  > {
    // Check if there's already an active session today
    const existing = await this.repo.findTodaySession(userId);
    if (existing && existing.status === "active") {
      // Resume: always fetch fresh questions (cache is for new sessions)
      const qResult = topicId
        ? await this.questionsService.selectForSubtopic(userId, topicId)
        : await this.questionsService.selectForSession(userId, mode);
      if (qResult.isErr()) return err(qResult.error);
      return ok({ session: existing, questions: qResult.value as QuestionItem[] });
    }

    if (existing && existing.status === "completed") {
      return err(
        new ValidationError("You already completed today's session")
      );
    }

    // Create new session
    const session = await this.repo.createSession(userId);
    if (!session) {
      return err(new NotFoundError("Failed to create session"));
    }

    // Skip question selection if caller has cached questions
    if (skipQuestions) {
      return ok({ session, questions: [] as QuestionItem[] });
    }

    const qResult = topicId
      ? await this.questionsService.selectForSubtopic(userId, topicId)
      : await this.questionsService.selectForSession(userId, mode);
    if (qResult.isErr()) return err(qResult.error);

    // Snapshot mastery for subtopics touched by the selected questions
    const subtopicIds = Array.from(
      new Set(qResult.value.map((q: { subtopicId: number }) => q.subtopicId)),
    );
    if (subtopicIds.length > 0) {
      const snapshot = await this.topicsService.snapshotMastery(userId, subtopicIds);
      await this.repo.writeMasterySnapshot(session.id, snapshot);
    }

    return ok({ session, questions: qResult.value as QuestionItem[] });
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
    questionsAnswered: number,
    questionsCorrect: number,
  ): Promise<
    Result<
      {
        session: Awaited<ReturnType<SessionsRepository["completeSession"]>>;
        transitions: import("@pruvi/shared").MasteryTransition[];
      },
      AppError
    >
  > {
    if (
      !Number.isInteger(questionsAnswered) ||
      !Number.isInteger(questionsCorrect) ||
      questionsAnswered < 0 ||
      questionsCorrect < 0 ||
      questionsCorrect > questionsAnswered
    ) {
      return err(new ValidationError("Invalid session completion metrics"));
    }

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

    const snapshot = await this.repo.readMasterySnapshot(sessionId);
    let transitions: import("@pruvi/shared").MasteryTransition[] = [];
    if (snapshot) {
      const subtopicIds = Object.keys(snapshot).map(Number);
      const { currentMap, namesMap } = await this.topicsService.getCurrentMasteryAndNames(
        userId,
        subtopicIds,
      );
      transitions = this.topicsService.computeTransitions(snapshot, currentMap, namesMap);
    }

    const completed = await this.repo.completeSession(sessionId, questionsAnswered, questionsCorrect);
    return ok({ session: completed, transitions });
  }
}
