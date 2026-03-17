import { ok, err, type Result } from "neverthrow";
import type { AppError } from "../../utils/errors";
import { NotFoundError } from "../../utils/errors";
import type { UsersRepository } from "./users.repository";

export class UsersService {
  constructor(private repo: UsersRepository) {}

  /** Export all user data (LGPD right to data portability) */
  async exportData(userId: string): Promise<
    Result<
      {
        profile: NonNullable<Awaited<ReturnType<UsersRepository["getProfile"]>>>;
        sessions: Awaited<ReturnType<UsersRepository["getAllSessions"]>>;
        reviews: Awaited<ReturnType<UsersRepository["getAllReviews"]>>;
      },
      AppError
    >
  > {
    const profile = await this.repo.getProfile(userId);
    if (!profile) {
      return err(new NotFoundError("User not found"));
    }

    const [sessions, reviews] = await Promise.all([
      this.repo.getAllSessions(userId),
      this.repo.getAllReviews(userId),
    ]);

    return ok({ profile, sessions, reviews });
  }

  /** Delete user account and all data (LGPD right to erasure) */
  async deleteAccount(userId: string): Promise<Result<void, AppError>> {
    const profile = await this.repo.getProfile(userId);
    if (!profile) {
      return err(new NotFoundError("User not found"));
    }

    await this.repo.deleteUser(userId);
    return ok(undefined);
  }
}
