import { err, ok, type Result } from "neverthrow";
import { randomUUID } from "node:crypto";
import {
  calculateXpForAnswer,
  difficultyFromNumber,
  type QualityScore,
  type RoletaAnswerBody,
  type RoletaAnswerResponse,
  type RoletaConfig,
  type RoletaConfigResponse,
  type RoletaStartResponse,
  type Subject,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { RoletaRepository } from "./roleta.repository";

const QUESTIONS_PER_SPIN = 3;

export class RoletaService {
  constructor(private repo: RoletaRepository) {}

  /** Read the user's eligible subjects, falling back to all if unset. */
  async getConfig(
    userId: string
  ): Promise<Result<RoletaConfigResponse, AppError>> {
    const configured = await this.repo.getConfig(userId);
    if (configured && configured.length > 0) {
      return ok({ subjects: configured });
    }
    const all = await this.repo.listSubjectSlugs();
    return ok({ subjects: all });
  }

  /** Persist the user's eligible-subject list after validating every slug. */
  async saveConfig(
    userId: string,
    payload: RoletaConfig
  ): Promise<Result<RoletaConfigResponse, AppError>> {
    const validSlugs = new Set(await this.repo.listSubjectSlugs());
    const unknown = payload.subjects.filter((s) => !validSlugs.has(s));
    if (unknown.length > 0) {
      return err(
        new ValidationError(`Unknown subject: ${unknown.join(", ")}`)
      );
    }
    await this.repo.saveConfig(userId, payload.subjects);
    return ok({ subjects: payload.subjects });
  }

  /**
   * Pick one random subject from the user's pool and return 3 questions
   * from it. The spinId is a correlation ID; the server does NOT persist
   * it — it only travels with the response so clients can group answers.
   */
  async spin(userId: string): Promise<Result<RoletaStartResponse, AppError>> {
    const configured = await this.repo.getConfig(userId);
    const pool =
      configured && configured.length > 0
        ? configured
        : await this.repo.listSubjectSlugs();

    if (pool.length === 0) {
      return err(new ValidationError("No subjects available"));
    }

    const pickedSlug = pool[Math.floor(Math.random() * pool.length)]!;
    const subjectRow = await this.repo.findSubjectBySlug(pickedSlug);
    if (!subjectRow) {
      return err(new NotFoundError(`Subject '${pickedSlug}' not found`));
    }

    const questions = await this.repo.selectRandomQuestions(
      subjectRow.id,
      QUESTIONS_PER_SPIN
    );
    if (questions.length === 0) {
      return err(
        new ValidationError(
          `Subject '${pickedSlug}' has no questions available`
        )
      );
    }

    // Strip correctOptionIndex before returning to the client.
    const clientQuestions = questions.map(
      ({ correctOptionIndex: _correct, ...rest }) => rest
    );

    const subject: Subject = {
      id: subjectRow.id,
      slug: subjectRow.slug,
      name: subjectRow.name,
    };

    return ok({
      spinId: randomUUID(),
      subject,
      questions: clientQuestions,
    });
  }

  /**
   * Grade a single Roleta answer. Writes a review_log row with source='roleta'
   * and null nextReviewAt; awards floor(baseXp / 2) on correct; awards 0 on
   * wrong. Does NOT touch lives (Roleta is free-play).
   */
  async answer(
    userId: string,
    body: RoletaAnswerBody
  ): Promise<Result<RoletaAnswerResponse, AppError>> {
    const q = await this.repo.findQuestionById(body.questionId);
    if (!q) {
      return err(new NotFoundError("Question not found"));
    }

    const correct = q.correctOptionIndex === body.selectedOptionIndex;
    const quality: QualityScore = correct ? 4 : 1;

    const baseXp = calculateXpForAnswer(
      correct,
      difficultyFromNumber(q.difficulty)
    );
    const xpAwarded = Math.floor(baseXp / 2);

    await this.repo.insertRoletaReview({
      userId,
      questionId: body.questionId,
      quality,
    });

    if (xpAwarded > 0) {
      await this.repo.awardXp(userId, xpAwarded);
    }

    return ok({
      correct,
      correctOptionIndex: q.correctOptionIndex,
      xpAwarded,
    });
  }
}
