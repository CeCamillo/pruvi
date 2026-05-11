import { err, ok, type Result } from "neverthrow";
import { AppError } from "../../utils/errors";
import type { TokensRepository } from "./tokens.repository";

export class TokensService {
  constructor(private repo: TokensRepository) {}

  async register(
    userId: string,
    token: string,
    platform: "ios" | "android",
  ): Promise<Result<{ id: number; token: string; platform: "ios" | "android" }, AppError>> {
    const row = await this.repo.upsert(userId, token, platform);
    if (!row) {
      return err(new AppError("Failed to upsert push token", 500, "UPSERT_FAILED"));
    }
    return ok({ id: row.id, token: row.token, platform: row.platform });
  }

  async unregister(userId: string, token: string): Promise<Result<null, AppError>> {
    await this.repo.deleteForUser(userId, token);
    return ok(null);
  }

  async listTokensForUser(userId: string): Promise<string[]> {
    const rows = await this.repo.listByUser(userId);
    return rows.map((r) => r.token);
  }
}
