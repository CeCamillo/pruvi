import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import type { db } from "@pruvi/db";

type DbClient = typeof db;

export type MasteryRow = { efAvg: number | null; reviewCount: number };

export type TrilhaRow = {
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
      efAvg: number | null;
      reviewCount: number;
    }>;
  }>;
};

export class TopicsRepository {
  constructor(private db: DbClient) {}

  async getTrilha(userId: string, subjectId: number): Promise<TrilhaRow | null> {
    const [sub] = await this.db
      .select({ id: subject.id, name: subject.name, slug: subject.slug })
      .from(subject)
      .where(eq(subject.id, subjectId))
      .limit(1);
    if (!sub) return null;

    const topics = await this.db
      .select({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        displayOrder: topic.displayOrder,
      })
      .from(topic)
      .where(eq(topic.subjectId, subjectId))
      .orderBy(asc(topic.displayOrder), asc(topic.id));

    if (topics.length === 0) {
      return { subject: sub, topics: [] };
    }

    const topicIds = topics.map((t) => t.id);
    const subtopics = await this.db
      .select({
        id: subtopic.id,
        topicId: subtopic.topicId,
        name: subtopic.name,
        slug: subtopic.slug,
        displayOrder: subtopic.displayOrder,
      })
      .from(subtopic)
      .where(inArray(subtopic.topicId, topicIds))
      .orderBy(asc(subtopic.displayOrder), asc(subtopic.id));

    const subtopicIds = subtopics.map((s) => s.id);
    const masteryMap = subtopicIds.length
      ? await this.getMasteryBySubtopics(userId, subtopicIds)
      : new Map<number, MasteryRow>();

    return {
      subject: sub,
      topics: topics.map((t) => ({
        ...t,
        subtopics: subtopics
          .filter((s) => s.topicId === t.id)
          .map((s) => {
            const m = masteryMap.get(s.id);
            return {
              id: s.id,
              name: s.name,
              slug: s.slug,
              displayOrder: s.displayOrder,
              efAvg: m?.efAvg ?? null,
              reviewCount: m?.reviewCount ?? 0,
            };
          }),
      })),
    };
  }

  async getTopicDetail(userId: string, topicId: number) {
    const [t] = await this.db
      .select({
        id: topic.id,
        name: topic.name,
        slug: topic.slug,
        subjectId: topic.subjectId,
        displayOrder: topic.displayOrder,
      })
      .from(topic)
      .where(eq(topic.id, topicId))
      .limit(1);
    if (!t) return null;

    const subtopics = await this.db
      .select({
        id: subtopic.id,
        name: subtopic.name,
        slug: subtopic.slug,
        displayOrder: subtopic.displayOrder,
      })
      .from(subtopic)
      .where(eq(subtopic.topicId, topicId))
      .orderBy(asc(subtopic.displayOrder), asc(subtopic.id));

    const ids = subtopics.map((s) => s.id);
    const masteryMap = ids.length
      ? await this.getMasteryBySubtopics(userId, ids)
      : new Map<number, MasteryRow>();

    return {
      topic: t,
      subtopics: subtopics.map((s) => {
        const m = masteryMap.get(s.id);
        return {
          ...s,
          efAvg: m?.efAvg ?? null,
          reviewCount: m?.reviewCount ?? 0,
        };
      }),
    };
  }

  async getMasteryBySubtopics(
    userId: string,
    subtopicIds: number[],
  ): Promise<Map<number, MasteryRow>> {
    if (subtopicIds.length === 0) return new Map();
    const rows = await this.db
      .select({
        subtopicId: question.subtopicId,
        efAvg: sql<string | null>`avg(${reviewLog.easinessFactor})`,
        reviewCount: sql<string>`count(*)`,
      })
      .from(reviewLog)
      .innerJoin(question, eq(question.id, reviewLog.questionId))
      .where(
        and(
          eq(reviewLog.userId, userId),
          inArray(question.subtopicId, subtopicIds),
        ),
      )
      .groupBy(question.subtopicId);

    const map = new Map<number, MasteryRow>();
    for (const row of rows) {
      map.set(row.subtopicId, {
        efAvg: row.efAvg === null ? null : Number(row.efAvg),
        reviewCount: Number(row.reviewCount),
      });
    }
    return map;
  }

  async getAllSubtopicMasteryForUser(
    userId: string,
    subjectIdFilter: number | null,
  ) {
    const baseSelect = this.db
      .select({
        subtopicId: subtopic.id,
        subtopicName: subtopic.name,
        topicId: topic.id,
        topicName: topic.name,
        subjectId: subject.id,
        subjectName: subject.name,
      })
      .from(subtopic)
      .innerJoin(topic, eq(topic.id, subtopic.topicId))
      .innerJoin(subject, eq(subject.id, topic.subjectId));

    const rows = subjectIdFilter
      ? await baseSelect.where(eq(subject.id, subjectIdFilter)).orderBy(asc(subject.id), asc(topic.displayOrder), asc(subtopic.displayOrder))
      : await baseSelect.orderBy(asc(subject.id), asc(topic.displayOrder), asc(subtopic.displayOrder));

    if (rows.length === 0) return [];

    const masteryMap = await this.getMasteryBySubtopics(userId, rows.map((r) => r.subtopicId));
    return rows.map((r) => {
      const m = masteryMap.get(r.subtopicId);
      return {
        ...r,
        efAvg: m?.efAvg ?? null,
        reviewCount: m?.reviewCount ?? 0,
      };
    });
  }

  async findSubtopicById(subtopicId: number) {
    const [row] = await this.db
      .select({ id: subtopic.id, topicId: subtopic.topicId, name: subtopic.name })
      .from(subtopic)
      .where(eq(subtopic.id, subtopicId))
      .limit(1);
    return row ?? null;
  }

  async findSubtopicsByIds(ids: number[]) {
    if (ids.length === 0) return [];
    return this.db
      .select({ id: subtopic.id, topicId: subtopic.topicId, name: subtopic.name })
      .from(subtopic)
      .where(inArray(subtopic.id, ids));
  }
}
