import { err, ok, type Result } from "neverthrow";
import { NotFoundError, type AppError } from "../../utils/errors";
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

  async deleteAccount(userId: string): Promise<Result<true, AppError>> {
    const existing = await this.repo.findById(userId);
    if (!existing) {
      return err(new NotFoundError("User not found"));
    }
    await this.repo.deleteUser(userId);
    return ok(true);
  }
}
