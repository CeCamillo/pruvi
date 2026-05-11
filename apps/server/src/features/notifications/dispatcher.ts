import type { Queue } from "bullmq";
import {
  streakReminderPrimary,
  streakReminderLate,
  streakMilestone,
  masteryAchievement,
  type PushPayload,
} from "./templates";
import type { TokensService } from "./tokens.service";
import type { PreferencesRepository } from "./preferences.repository";
import { EXPO_BATCH_SIZE } from "./push.client";

export type AchievementKind = "7-day-streak" | "30-day-streak" | "quase-mestre";

export type SendJobData = {
  tokens: string[];
  title: string;
  body: string;
  data?: Record<string, unknown>;
};

export type SweepRepoLike = {
  findEligibleForStreakReminder(brtHour: number): Promise<Array<{ userId: string; token: string }>>;
};

export type DispatcherDeps = {
  tokensService: TokensService;
  prefsRepo: PreferencesRepository;
  sweepRepo: SweepRepoLike;
  sendQueue: Queue<SendJobData>;
};

export class Dispatcher {
  constructor(private deps: DispatcherDeps) {}

  async sendAchievementNotification(
    userId: string,
    kind: AchievementKind,
    vars?: { subtopicName?: string },
  ): Promise<void> {
    const prefs = await this.deps.prefsRepo.get(userId);
    if (!prefs?.achievementNotificationsEnabled) return;

    const tokens = await this.deps.tokensService.listTokensForUser(userId);
    if (tokens.length === 0) return;

    let payload: PushPayload;
    if (kind === "7-day-streak") payload = streakMilestone(7);
    else if (kind === "30-day-streak") payload = streakMilestone(30);
    else payload = masteryAchievement(vars?.subtopicName ?? "");

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const chunk = tokens.slice(i, i + EXPO_BATCH_SIZE);
      await this.deps.sendQueue.add("send", {
        tokens: chunk,
        title: payload.title,
        body: payload.body,
        data: { kind },
      });
    }
  }

  async dispatchStreakReminder(opts: { brtHour: number; variant: "primary" | "late" }): Promise<void> {
    const targetHour = opts.variant === "late" ? (opts.brtHour - 2 + 24) % 24 : opts.brtHour;
    const eligible = await this.deps.sweepRepo.findEligibleForStreakReminder(targetHour);
    if (eligible.length === 0) return;

    const payload = opts.variant === "late" ? streakReminderLate() : streakReminderPrimary();
    const tokens = eligible.map((r) => r.token);

    for (let i = 0; i < tokens.length; i += EXPO_BATCH_SIZE) {
      const chunk = tokens.slice(i, i + EXPO_BATCH_SIZE);
      await this.deps.sendQueue.add("send", {
        tokens: chunk,
        title: payload.title,
        body: payload.body,
        data: { kind: `streak-${opts.variant}` },
      });
    }
  }
}
