import { ok, err, type Result } from "neverthrow";
import type { AppError } from "../../../utils/errors";
import { NotFoundError, ValidationError } from "../../../utils/errors";
import type { FriendshipsRepository } from "./friendships.repository";

export class FriendshipsService {
  constructor(private repo: FriendshipsRepository) {}

  async requestByUsername(
    requesterId: string,
    username: string,
  ): Promise<
    Result<
      { requestId: number; recipient: { username: string | null; name: string } },
      AppError
    >
  > {
    const target = await this.repo.findByUsername(username);
    if (!target) return err(new NotFoundError("User not found"));
    if (target.id === requesterId)
      return err(new ValidationError("Cannot friend yourself"));
    const existing = await this.repo.findExistingPair(requesterId, target.id);
    if (existing)
      return err(
        new ValidationError(`Friendship already exists with status ${existing.status}`),
      );
    const row = await this.repo.createRequest(requesterId, target.id);
    return ok({ requestId: row.id, recipient: { username: target.username, name: target.name } });
  }

  async respond(
    id: number,
    action: "accept" | "decline",
    userId: string,
  ): Promise<Result<{ status: "accepted" | "declined" }, AppError>> {
    const req = await this.repo.getRequest(id, userId);
    if (!req) return err(new NotFoundError("Request not found"));
    await this.repo.respond(id, action);
    return ok({ status: action === "accept" ? "accepted" : "declined" });
  }

  async listFriends(userId: string) {
    return ok({ friends: await this.repo.listAcceptedFriendsWithUserData(userId) });
  }

  async listRequests(userId: string) {
    const rows = await this.repo.listIncomingRequests(userId);
    return ok({
      incoming: rows.map((r) => ({
        id: r.id,
        from: r.from,
        createdAt: r.createdAt.toISOString(),
      })),
    });
  }

  async unfriend(userId: string, otherUserId: string): Promise<Result<void, AppError>> {
    await this.repo.deletePair(userId, otherUserId);
    return ok(undefined);
  }
}
