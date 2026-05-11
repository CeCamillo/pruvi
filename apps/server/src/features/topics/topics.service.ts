import { err, ok, type Result } from "neverthrow";
import {
  computeMastery,
  masteryStateRank,
  type MasteryState,
  type MasteryTransition,
} from "@pruvi/shared";
import { NotFoundError, type AppError } from "../../utils/errors";
import type { TopicsRepository } from "./topics.repository";

type MasteryListItem = {
  subtopicId: number;
  subtopicName: string;
  topicId: number;
  topicName: string;
  subjectId: number;
  subjectName: string;
  efAvg: number | null;
  reviewCount: number;
  state: MasteryState;
};

export class TopicsService {
  constructor(private repo: TopicsRepository) {}

  async getTrilha(
    userId: string,
    subjectId: number,
  ): Promise<Result<{
    subject: { id: number; name: string; slug: string };
    topics: Array<{
      id: number;
      name: string;
      slug: string;
      displayOrder: number;
      subtopics: Array<{
        id: number;
        name: string;
        slug: string;
        displayOrder: number;
        state: MasteryState;
        efAvg: number | null;
        reviewCount: number;
      }>;
    }>;
  }, AppError>> {
    const row = await this.repo.getTrilha(userId, subjectId);
    if (!row) {
      return err(new NotFoundError("Subject not found"));
    }
    return ok({
      subject: row.subject,
      topics: row.topics.map((t) => ({
        ...t,
        subtopics: t.subtopics.map((s) => ({
          ...s,
          state: computeMastery(s.efAvg, s.reviewCount),
        })),
      })),
    });
  }

  async getTopicDetail(userId: string, topicId: number) {
    const row = await this.repo.getTopicDetail(userId, topicId);
    if (!row) {
      return err(new NotFoundError("Topic not found"));
    }
    return ok({
      topic: row.topic,
      subtopics: row.subtopics.map((s) => ({
        ...s,
        state: computeMastery(s.efAvg, s.reviewCount),
      })),
    });
  }

  async getUserMastery(
    userId: string,
    subjectId: number | null,
  ): Promise<Result<{ items: MasteryListItem[] }, AppError>> {
    const rows = await this.repo.getAllSubtopicMasteryForUser(userId, subjectId);
    return ok({
      items: rows.map((r) => ({
        ...r,
        state: computeMastery(r.efAvg, r.reviewCount),
      })),
    });
  }

  async snapshotMastery(
    userId: string,
    subtopicIds: number[],
  ): Promise<Record<string, MasteryState>> {
    if (subtopicIds.length === 0) return {};
    const masteryMap = await this.repo.getMasteryBySubtopics(userId, subtopicIds);
    const out: Record<string, MasteryState> = {};
    for (const id of subtopicIds) {
      const m = masteryMap.get(id);
      out[String(id)] = computeMastery(m?.efAvg ?? null, m?.reviewCount ?? 0);
    }
    return out;
  }

  computeTransitions(
    snapshot: Record<string, MasteryState> | null,
    current: Map<number, MasteryState>,
    names: Map<number, string>,
  ): MasteryTransition[] {
    if (!snapshot) return [];
    const out: MasteryTransition[] = [];
    for (const [idStr, from] of Object.entries(snapshot)) {
      const id = Number(idStr);
      const to = current.get(id);
      if (!to) continue;
      if (masteryStateRank(to) > masteryStateRank(from)) {
        out.push({
          subtopicId: id,
          name: names.get(id) ?? "",
          from,
          to,
        });
      }
    }
    return out;
  }

  async findSubtopicById(id: number) {
    return this.repo.findSubtopicById(id);
  }

  /** Used by sessions complete flow to look up names + current mastery rows. */
  async getCurrentMasteryAndNames(userId: string, subtopicIds: number[]) {
    const [masteryMap, subtopics] = await Promise.all([
      this.repo.getMasteryBySubtopics(userId, subtopicIds),
      this.repo.findSubtopicsByIds(subtopicIds),
    ]);
    const currentMap = new Map<number, MasteryState>();
    const namesMap = new Map<number, string>();
    for (const id of subtopicIds) {
      const m = masteryMap.get(id);
      currentMap.set(id, computeMastery(m?.efAvg ?? null, m?.reviewCount ?? 0));
    }
    for (const sub of subtopics) {
      namesMap.set(sub.id, sub.name);
    }
    return { currentMap, namesMap };
  }
}
