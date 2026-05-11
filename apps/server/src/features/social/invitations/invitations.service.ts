import { ok, err, type Result } from "neverthrow";
import type { AppError } from "../../../utils/errors";
import { NotFoundError, ValidationError } from "../../../utils/errors";
import type { InvitationsRepository } from "./invitations.repository";

const INVITE_URL_BASE = process.env.INVITE_URL_BASE ?? "https://pruvi.app/i";

export class InvitationsService {
  constructor(private repo: InvitationsRepository) {}

  async getInvite(
    userId: string,
  ): Promise<Result<{ code: string; url: string }, AppError>> {
    const code = await this.repo.ensureInviteCode(userId);
    return ok({ code, url: `${INVITE_URL_BASE}/${code}` });
  }

  async acceptInvitation(
    code: string,
    userId: string,
  ): Promise<
    Result<
      {
        inviter: { name: string; username: string | null };
        xpAwarded: number;
        friendshipCreated: true;
      },
      AppError
    >
  > {
    const inviter = await this.repo.findInviterByCode(code);
    if (!inviter) return err(new NotFoundError("Invite code not found"));
    if (inviter.id === userId)
      return err(new ValidationError("Cannot accept your own invite"));
    if (await this.repo.hasAccepted(userId))
      return err(new ValidationError("You have already accepted an invitation"));
    try {
      await this.repo.acceptInvitation(inviter.id, userId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (
        msg.includes("friendship_pair_idx") ||
        msg.includes("invitation_acceptance")
      ) {
        return err(new ValidationError("Invitation already processed"));
      }
      throw e;
    }
    return ok({
      inviter: { name: inviter.name, username: inviter.username },
      xpAwarded: 100,
      friendshipCreated: true as const,
    });
  }
}
