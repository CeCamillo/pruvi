import { err, ok, type Result } from "neverthrow";
import { ValidationError, AppError } from "../../utils/errors";
import type { ProgressRepository } from "./progress.repository";

const MAX_RANGE_DAYS = 400;

export interface ProgressView {
  totalReviews: number;
  totalCorrect: number;
  accuracy: number;
  bySubject: Array<{
    subjectSlug: string;
    subjectName: string;
    totalReviews: number;
    totalCorrect: number;
    accuracy: number;
  }>;
}

function safeAccuracy(correct: number, reviews: number): number {
  if (reviews === 0) return 0;
  return correct / reviews;
}

function daysBetween(from: string, to: string): number {
  const fromMs = Date.parse(`${from}T00:00:00Z`);
  const toMs = Date.parse(`${to}T00:00:00Z`);
  return Math.floor((toMs - fromMs) / 86400000);
}

export class ProgressService {
  constructor(private repo: ProgressRepository) {}

  async getProgress(userId: string): Promise<Result<ProgressView, AppError>> {
    const rows = await this.repo.getProgressBySubject(userId);

    const bySubject = rows.map((r) => ({
      subjectSlug: r.subjectSlug,
      subjectName: r.subjectName,
      totalReviews: r.totalReviews,
      totalCorrect: r.totalCorrect,
      accuracy: safeAccuracy(r.totalCorrect, r.totalReviews),
    }));

    const totalReviews = bySubject.reduce((sum, s) => sum + s.totalReviews, 0);
    const totalCorrect = bySubject.reduce((sum, s) => sum + s.totalCorrect, 0);

    return ok({
      totalReviews,
      totalCorrect,
      accuracy: safeAccuracy(totalCorrect, totalReviews),
      bySubject,
    });
  }

  async getCalendar(
    userId: string,
    from: string,
    to: string
  ): Promise<Result<{ dates: string[] }, AppError>> {
    const diff = daysBetween(from, to);
    if (Number.isNaN(diff)) {
      return err(new ValidationError("Invalid date format"));
    }
    if (diff < 0) {
      return err(new ValidationError("'to' must be on or after 'from'"));
    }
    if (diff > MAX_RANGE_DAYS) {
      return err(
        new AppError(
          `Range exceeds ${MAX_RANGE_DAYS} days`,
          400,
          "RANGE_TOO_LARGE"
        )
      );
    }

    const dates = await this.repo.getCompletedDatesInRange(userId, from, to);
    return ok({ dates });
  }
}
