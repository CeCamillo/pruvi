import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { setupTestDb, getTestDb, getTestPool } from "../../test/db-helpers";
import { subject } from "@pruvi/db/schema/subjects";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { question } from "@pruvi/db/schema/questions";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { user } from "@pruvi/db/schema/auth";
import { TopicsRepository } from "./topics.repository";

const db = getTestDb();
const repo = new TopicsRepository(db);

const USER_ID = "user_topics_repo_test";

async function seed() {
  const [sub] = await db.insert(subject).values({ name: "Biologia", slug: "biologia" }).returning();
  if (!sub) throw new Error("Failed to insert subject");
  const [t] = await db.insert(topic).values({ subjectId: sub.id, name: "Citologia", slug: "citologia", displayOrder: 0 }).returning();
  if (!t) throw new Error("Failed to insert topic");
  const [stA] = await db.insert(subtopic).values({ topicId: t.id, name: "Membrana", slug: "membrana", displayOrder: 0 }).returning();
  if (!stA) throw new Error("Failed to insert subtopic A");
  const [stB] = await db.insert(subtopic).values({ topicId: t.id, name: "Citoplasma", slug: "citoplasma", displayOrder: 1 }).returning();
  if (!stB) throw new Error("Failed to insert subtopic B");
  const [q] = await db.insert(question).values({
    content: "Q?",
    options: ["a","b","c","d"],
    correctOptionIndex: 0,
    difficulty: "medium",
    subjectId: sub.id,
    subtopicId: stA.id,
  }).returning();
  if (!q) throw new Error("Failed to insert question");
  await db.insert(user).values({ id: USER_ID, name: "T", email: `${USER_ID}@x.com` });
  return { sub, t, stA, stB, q };
}

async function clearAll() {
  await db.delete(reviewLog);
  await db.delete(question);
  await db.delete(subtopic);
  await db.delete(topic);
  await db.delete(subject);
  await db.delete(user).where(eq(user.id, USER_ID));
}

beforeAll(async () => {
  await setupTestDb();
});

afterAll(async () => {
  await getTestPool().end();
});

beforeEach(async () => {
  await clearAll();
});

describe("TopicsRepository.getTrilha", () => {
  it("returns nested subject → topics → subtopics shape", async () => {
    const { sub } = await seed();
    const result = await repo.getTrilha(USER_ID, sub.id);
    expect(result).not.toBeNull();
    expect(result!.subject.slug).toBe("biologia");
    expect(result!.topics).toHaveLength(1);
    const topicResult = result!.topics[0]!;
    expect(topicResult.subtopics).toHaveLength(2);
    expect(topicResult.subtopics[0]!.slug).toBe("membrana");
    expect(topicResult.subtopics[1]!.slug).toBe("citoplasma");
    expect(topicResult.subtopics[0]!.efAvg).toBeNull();
    expect(topicResult.subtopics[0]!.reviewCount).toBe(0);
  });

  it("rolls up review_log entries into ef_avg and reviewCount per subtopic", async () => {
    const { stA, q } = await seed();
    const efs = ["2.3","2.4","2.5","2.6","2.7"];
    for (const ef of efs) {
      await db.insert(reviewLog).values({
        userId: USER_ID,
        questionId: q.id,
        quality: 4,
        easinessFactor: ef,
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(),
      });
    }
    const map = await repo.getMasteryBySubtopics(USER_ID, [stA.id]);
    expect(map.get(stA.id)?.reviewCount).toBe(5);
    expect(map.get(stA.id)?.efAvg).toBeCloseTo(2.5, 1);
  });

  it("getAllSubtopicMasteryForUser returns a flat list across all subjects", async () => {
    await seed();
    const items = await repo.getAllSubtopicMasteryForUser(USER_ID, null);
    expect(items.length).toBeGreaterThanOrEqual(2);
    expect(items[0]).toHaveProperty("subtopicId");
    expect(items[0]).toHaveProperty("topicId");
    expect(items[0]).toHaveProperty("subjectId");
  });

  it("getAllSubtopicMasteryForUser filters by subjectId", async () => {
    const { sub } = await seed();
    const items = await repo.getAllSubtopicMasteryForUser(USER_ID, sub.id);
    expect(items.every((i) => i.subjectId === sub.id)).toBe(true);
  });
});
