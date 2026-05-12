import { describe, it, expect, vi } from "vitest";
import { RankingService } from "./ranking.service";
import type { RankingRepository } from "./ranking.repository";
import type { RawRankingRow } from "./ranking.repository";

function makeRepo(rows: RawRankingRow[]): RankingRepository {
  return {
    getFriendsRanking: vi.fn().mockResolvedValue(rows),
  } as unknown as RankingRepository;
}

/** Build a sorted list of N rows: the row at index `meIndex` has userId "me". */
function buildRows(count: number, meIndex: number, ultraIndices: number[] = []): RawRankingRow[] {
  return Array.from({ length: count }, (_, i) => ({
    user_id: i === meIndex ? "me" : `user-${i}`,
    name: i === meIndex ? "Me" : `User ${i}`,
    username: null,
    image: null,
    // XP decreasing so index order = rank order
    weekly_xp: (count - i) * 10,
    is_ultra: ultraIndices.includes(i),
  }));
}

const NOW = new Date("2026-05-13T15:00:00Z"); // Wednesday noon BRT

describe("RankingService", () => {
  describe("fewer than 11 entries — returns all sorted", () => {
    it("returns all entries when total <= 10", async () => {
      const rows = buildRows(5, 2);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries).toHaveLength(5);
      // ranks are 1-based, ascending
      expect(result.entries[0]?.rank).toBe(1);
      expect(result.entries[4]?.rank).toBe(5);
      // isMe flag set correctly
      expect(result.entries[2]?.isMe).toBe(true);
      expect(result.entries[0]?.isMe).toBe(false);
    });

    it("returns all entries when total equals exactly 10", async () => {
      const rows = buildRows(10, 5);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries).toHaveLength(10);
    });
  });

  describe("trim behaviour with 13 entries (>10)", () => {
    it("me at top (index 0) → returns first 10 entries", async () => {
      const rows = buildRows(13, 0);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries).toHaveLength(10);
      // me is at position 0 → first entry
      expect(result.entries[0]?.isMe).toBe(true);
      // ranks 1-10
      expect(result.entries[0]?.rank).toBe(1);
      expect(result.entries[9]?.rank).toBe(10);
      // user at index 12 should NOT be included
      expect(result.entries.some((e) => e.userId === "user-12")).toBe(false);
    });

    it("me at middle (index 6) → 5 above + me + 4 below (window [1..10])", async () => {
      const rows = buildRows(13, 6);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries).toHaveLength(10);
      // start = max(0, min(13-10, 6-5)) = max(0, min(3, 1)) = 1
      // slice [1, 11)
      expect(result.entries.some((e) => e.isMe)).toBe(true);
      const meEntry = result.entries.find((e) => e.isMe)!;
      // me is at global rank 7 (index 6 → rank 7)
      expect(meEntry.rank).toBe(7);
      // window covers ranks 2-11 (indices 1-10)
      expect(result.entries[0]?.rank).toBe(2);
      expect(result.entries[9]?.rank).toBe(11);
    });

    it("me at bottom (index 12) → last 10 entries", async () => {
      const rows = buildRows(13, 12);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries).toHaveLength(10);
      // start = max(0, min(3, 7)) = 3 → slice [3, 13)
      expect(result.entries.some((e) => e.isMe)).toBe(true);
      const meEntry = result.entries.find((e) => e.isMe)!;
      expect(meEntry.rank).toBe(13);
      // last entry has rank 13, first has rank 4
      expect(result.entries[0]?.rank).toBe(4);
      expect(result.entries[9]?.rank).toBe(13);
    });
  });

  describe("weekStart ISO string", () => {
    it("includes weekStart as an ISO datetime string", async () => {
      const rows = buildRows(3, 1);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      // For 2026-05-13 Wed noon BRT → weekStart = 2026-05-11T03:00:00.000Z
      expect(result.weekStart).toBe("2026-05-11T03:00:00.000Z");
    });
  });

  describe("isMe flag", () => {
    it("sets isMe=true only for the requesting userId", async () => {
      const rows = buildRows(4, 2);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      const meEntries = result.entries.filter((e) => e.isMe);
      expect(meEntries).toHaveLength(1);
      expect(meEntries[0]?.userId).toBe("me");
    });
  });

  describe("isUltra flag", () => {
    it("passes isUltra=false for all entries when no Ultra users", async () => {
      const rows = buildRows(4, 1); // no ultraIndices → all false
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries.every((e) => e.isUltra === false)).toBe(true);
    });

    it("passes isUltra=true for all entries when all are Ultra", async () => {
      const rows = buildRows(4, 1, [0, 1, 2, 3]);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries.every((e) => e.isUltra === true)).toBe(true);
    });

    it("passes isUltra per-entry correctly when some are Ultra and some are not", async () => {
      // 5 entries; indices 0, 2 are Ultra; indices 1, 3, 4 are not
      const rows = buildRows(5, 4, [0, 2]);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      expect(result.entries).toHaveLength(5);

      // index 0 → ultra
      expect(result.entries[0]?.isUltra).toBe(true);
      // index 1 → not ultra
      expect(result.entries[1]?.isUltra).toBe(false);
      // index 2 → ultra
      expect(result.entries[2]?.isUltra).toBe(true);
      // index 3 → not ultra
      expect(result.entries[3]?.isUltra).toBe(false);
      // index 4 (me) → not ultra
      expect(result.entries[4]?.isUltra).toBe(false);
    });

    it("isUltra flag is preserved after trim window is applied", async () => {
      // 13 entries; me at index 6, only index 3 is Ultra
      const rows = buildRows(13, 6, [3]);
      const service = new RankingService(makeRepo(rows));

      const result = await service.getRanking("me", NOW);

      // trim window: start = max(0, min(3,1)) = 1, slice [1,11)
      // index 3 in original = index 2 in the window (1-based offset of 1)
      expect(result.entries).toHaveLength(10);

      // Find the ultra entry in results
      const ultraEntries = result.entries.filter((e) => e.isUltra);
      expect(ultraEntries).toHaveLength(1);
      // The ultra user is user-3 (index 3 in original rows)
      expect(ultraEntries[0]?.userId).toBe("user-3");
    });
  });
});
