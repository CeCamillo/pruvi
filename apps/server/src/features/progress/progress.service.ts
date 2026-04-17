import { err, ok, type Result } from "neverthrow";
import {
  qualityToCorrect,
  type ProgressResponse,
  type SubjectReviewsResponse,
  type CalendarResponse,
} from "@pruvi/shared";
import type { AppError } from "../../utils/errors";
import { NotFoundError, ValidationError } from "../../utils/errors";
import type { ProgressRepository } from "./progress.repository";
import { formatMonth, isFutureMonth, monthBoundaries } from "./month-utils";

export class ProgressService {
  constructor(private repo: ProgressRepository) {}

  async getProgress(userId: string): Promise<Result<ProgressResponse, AppError>> {
    const rows = await this.repo.getProgressForUser(userId);
    return ok({
      subjects: rows.map((r) => ({
        slug: r.slug,
        name: r.name,
        totalQuestions: r.totalQuestions,
        correctCount: r.correctCount,
        accuracy:
          r.totalQuestions === 0
            ? 0
            : Math.round((r.correctCount / r.totalQuestions) * 100),
      })),
    });
  }

  async getSubjectReviews(
    userId: string,
    slug: string,
  ): Promise<Result<SubjectReviewsResponse, AppError>> {
    if (!(await this.repo.subjectExists(slug))) {
      return err(new NotFoundError("Subject not found"));
    }
    const rows = await this.repo.getSubjectReviews(userId, slug, 50);
    return ok({
      reviews: rows.map((r) => ({
        questionId: r.questionId,
        body: r.body,
        correct: qualityToCorrect(r.quality),
        reviewedAt: r.reviewedAt.toISOString(),
      })),
    });
  }

  async getCalendar(
    userId: string,
    month: string | undefined,
  ): Promise<Result<CalendarResponse, AppError>> {
    const target = month ?? formatMonth(new Date());
    if (isFutureMonth(target)) {
      return err(new ValidationError("month cannot be in the future"));
    }
    const { start, end } = monthBoundaries(target);
    const dates = await this.repo.getCalendarDates(userId, start, end);
    return ok({ dates });
  }
}
