import { err, ok, type Result } from "neverthrow";
import { ConflictError, NotFoundError, type AppError } from "../../utils/errors";
import type { UsersRepository } from "./users.repository";

type Profile = NonNullable<Awaited<ReturnType<UsersRepository["findById"]>>>;

export class UsersService {
  constructor(private repo: UsersRepository) {}

  async updateProfile(
    userId: string,
    patch: { name?: string; image?: string | null }
  ): Promise<Result<Profile, AppError>> {
    const updated = await this.repo.updateProfile(userId, patch);
    if (!updated) {
      return err(new NotFoundError("User not found"));
    }
    return ok(updated);
  }

  async updateUsername(
    userId: string,
    username: string
  ): Promise<Result<{ username: string }, AppError>> {
    const normalised = username.toLowerCase();
    try {
      const row = await this.repo.updateUsername(userId, normalised);
      if (!row) {
        return err(new NotFoundError("User not found"));
      }
      return ok({ username: row.username as string });
    } catch (e) {
      const isUsernameUnique = (err: unknown): boolean => {
        if (!(err instanceof Error)) return false;
        if (err.message.includes("user_username_unique")) return true;
        // Drizzle wraps the pg error in e.cause; pg also exposes `constraint`
        const cause = (err as Error & { cause?: unknown }).cause;
        if (cause instanceof Error) {
          if (cause.message.includes("user_username_unique")) return true;
          const pgConstraint = (cause as Error & { constraint?: string }).constraint;
          if (pgConstraint === "user_username_unique") return true;
        }
        return false;
      };
      if (isUsernameUnique(e)) {
        return err(new ConflictError("Username is already taken"));
      }
      throw e;
    }
  }

  async deleteAccount(userId: string): Promise<Result<true, AppError>> {
    const existing = await this.repo.findById(userId);
    if (!existing) {
      return err(new NotFoundError("User not found"));
    }
    await this.repo.deleteUser(userId);
    return ok(true);
  }
}
