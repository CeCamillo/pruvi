import { err, ok, type Result } from "neverthrow";
import { NotFoundError, ValidationError, type AppError } from "../../utils/errors";
import type {
  PreferencesRepository,
  PrefsPatch,
  PrefsRow,
} from "./preferences.repository";

export class PreferencesService {
  constructor(private repo: PreferencesRepository) {}

  async get(userId: string): Promise<Result<PrefsRow, AppError>> {
    const prefs = await this.repo.get(userId);
    if (!prefs) return err(new NotFoundError("User not found"));
    return ok(prefs);
  }

  async update(userId: string, patch: PrefsPatch): Promise<Result<PrefsRow, AppError>> {
    if (patch.notificationHour !== undefined) {
      if (
        !Number.isInteger(patch.notificationHour) ||
        patch.notificationHour < 0 ||
        patch.notificationHour > 23
      ) {
        return err(new ValidationError("notificationHour must be 0–23"));
      }
    }
    const updated = await this.repo.update(userId, patch);
    if (!updated) return err(new NotFoundError("User not found"));
    return ok(updated);
  }
}
