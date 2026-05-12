import { startOfWeekBrt } from "@pruvi/shared";
import type { RankingRepository } from "./ranking.repository";

export class RankingService {
  constructor(private repo: RankingRepository) {}

  async getRanking(userId: string, now: Date) {
    const weekStart = startOfWeekBrt(now);
    const rows = await this.repo.getFriendsRanking(userId, weekStart);

    const ranked = rows.map((r, i) => ({
      userId: r.user_id,
      name: r.name,
      username: r.username,
      image: r.image,
      weeklyXp: r.weekly_xp,
      rank: i + 1,
      isMe: r.user_id === userId,
      isUltra: r.is_ultra,
    }));

    let entries = ranked;
    if (ranked.length > 10) {
      const meIdx = ranked.findIndex((e) => e.isMe);
      // Take 5 above + 4 below (10 total including me), clamp at edges.
      const start = Math.max(0, Math.min(ranked.length - 10, meIdx - 5));
      entries = ranked.slice(start, start + 10);
    }

    return {
      weekStart: weekStart.toISOString(),
      entries,
    };
  }
}
