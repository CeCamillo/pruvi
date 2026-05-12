import { ok, err, type Result } from "neverthrow";
import { AppError, NotFoundError } from "../../utils/errors";
import type { UltraRepository } from "./ultra.repository";

export class UltraService {
  constructor(private repo: UltraRepository) {}

  async isUltra(userId: string): Promise<boolean> {
    const row = await this.repo.get(userId);
    if (!row?.isUltra) return false;
    if (row.ultraExpiresAt && row.ultraExpiresAt < new Date()) return false;
    return true;
  }

  async getStatus(userId: string): Promise<Result<{ isUltra: boolean; expiresAt: string | null }, AppError>> {
    const row = await this.repo.get(userId);
    if (!row) return err(new NotFoundError("User not found"));
    const effective = row.isUltra && (!row.ultraExpiresAt || row.ultraExpiresAt > new Date());
    return ok({ isUltra: effective, expiresAt: row.ultraExpiresAt?.toISOString() ?? null });
  }

  async grant(userId: string, expiresAt: Date): Promise<Result<void, AppError>> {
    await this.repo.grant(userId, expiresAt);
    return ok(undefined);
  }

  async revoke(userId: string): Promise<Result<void, AppError>> {
    await this.repo.revoke(userId);
    return ok(undefined);
  }
}
