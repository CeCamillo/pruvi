import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  setupTestDb,
  teardownTestDb,
  cleanupTestDb,
  getTestDb,
} from "../../test/db-helpers";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { topic, subtopic } from "@pruvi/db/schema/topics";
import { reviewLog } from "@pruvi/db/schema/review-log";
import { dailySession } from "@pruvi/db/schema/daily-sessions";
import { ProgressRepository } from "./progress.repository";

const USER_ID = "test-progress-user";

describe("ProgressRepository integration", () => {
  let repo: ProgressRepository;

  beforeAll(async () => {
    await setupTestDb();
    repo = new ProgressRepository(getTestDb());
  });

  beforeEach(async () => {
    await cleanupTestDb();
  });

  afterAll(async () => {
    await teardownTestDb();
  });

  it("getProgressBySubject aggregates reviews per subject and counts correct vs wrong", async () => {
    const db = getTestDb();

    await db.insert(user).values({
      id: USER_ID,
      name: "Test",
      email: "test@example.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    const [subjA] = await db
      .insert(subject)
      .values({ name: "Matemática", slug: "matematica" })
      .returning();
    const [subjB] = await db
      .insert(subject)
      .values({ name: "Biologia", slug: "biologia" })
      .returning();

    if (!subjA || !subjB) throw new Error("Failed to seed subjects");

    const [tA] = await db
      .insert(topic)
      .values({ subjectId: subjA.id, name: "Test Topic", slug: "test-topic-mat", displayOrder: 0 })
      .returning();
    const [stA] = await db
      .insert(subtopic)
      .values({ topicId: tA.id, name: "Test Subtopic", slug: "test-subtopic-mat", displayOrder: 0 })
      .returning();

    const [tB] = await db
      .insert(topic)
      .values({ subjectId: subjB.id, name: "Test Topic", slug: "test-topic-bio", displayOrder: 0 })
      .returning();
    const [stB] = await db
      .insert(subtopic)
      .values({ topicId: tB.id, name: "Test Subtopic", slug: "test-subtopic-bio", displayOrder: 0 })
      .returning();

    const [q1] = await db
      .insert(question)
      .values({
        content: "Q1",
        options: ["a", "b", "c", "d"],
        correctOptionIndex: 0,
        difficulty: "easy",
        subjectId: subjA.id,
        subtopicId: stA.id,
      })
      .returning();
    const [q2] = await db
      .insert(question)
      .values({
        content: "Q2",
        options: ["a", "b", "c", "d"],
        correctOptionIndex: 1,
        difficulty: "medium",
        subjectId: subjB.id,
        subtopicId: stB.id,
      })
      .returning();

    if (!q1 || !q2) throw new Error("Failed to seed questions");

    // 2 reviews on subjA (1 correct quality=4, 1 wrong quality=1), 1 review on subjB (correct)
    await db.insert(reviewLog).values([
      {
        userId: USER_ID,
        questionId: q1.id,
        quality: 4,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 86400000),
      },
      {
        userId: USER_ID,
        questionId: q1.id,
        quality: 1,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 0,
        nextReviewAt: new Date(Date.now() + 86400000),
      },
      {
        userId: USER_ID,
        questionId: q2.id,
        quality: 4,
        easinessFactor: "2.50",
        interval: 1,
        repetitions: 1,
        nextReviewAt: new Date(Date.now() + 86400000),
      },
    ]);

    const rows = await repo.getProgressBySubject(USER_ID);

    expect(rows).toHaveLength(2);
    const biologia = rows.find((r) => r.subjectSlug === "biologia");
    const matematica = rows.find((r) => r.subjectSlug === "matematica");

    expect(biologia).toEqual({
      subjectSlug: "biologia",
      subjectName: "Biologia",
      totalReviews: 1,
      totalCorrect: 1,
    });
    expect(matematica).toEqual({
      subjectSlug: "matematica",
      subjectName: "Matemática",
      totalReviews: 2,
      totalCorrect: 1,
    });
  });

  it("getCompletedDatesInRange returns distinct completed-session dates within range", async () => {
    const db = getTestDb();

    await db.insert(user).values({
      id: USER_ID,
      name: "Test",
      email: "test@example.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    // 3 sessions across 3 dates; only 2 are completed.
    await db.insert(dailySession).values([
      {
        userId: USER_ID,
        status: "completed",
        questionsAnswered: 10,
        questionsCorrect: 8,
        completedAt: new Date("2026-05-01T15:00:00Z"),
        createdAt: new Date("2026-05-01T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "completed",
        questionsAnswered: 10,
        questionsCorrect: 7,
        completedAt: new Date("2026-05-03T15:00:00Z"),
        createdAt: new Date("2026-05-03T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "active",
        createdAt: new Date("2026-05-05T15:00:00Z"),
      },
    ]);

    const dates = await repo.getCompletedDatesInRange(
      USER_ID,
      "2026-05-01",
      "2026-05-31"
    );

    expect(dates).toEqual(["2026-05-01", "2026-05-03"]);
  });

  it("getCompletedDatesInRange excludes dates outside the range", async () => {
    const db = getTestDb();

    await db.insert(user).values({
      id: USER_ID,
      name: "Test",
      email: "test@example.com",
      emailVerified: false,
      updatedAt: new Date(),
    });

    await db.insert(dailySession).values([
      {
        userId: USER_ID,
        status: "completed",
        completedAt: new Date("2026-04-30T15:00:00Z"),
        createdAt: new Date("2026-04-30T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "completed",
        completedAt: new Date("2026-05-15T15:00:00Z"),
        createdAt: new Date("2026-05-15T15:00:00Z"),
      },
      {
        userId: USER_ID,
        status: "completed",
        completedAt: new Date("2026-06-01T15:00:00Z"),
        createdAt: new Date("2026-06-01T15:00:00Z"),
      },
    ]);

    const dates = await repo.getCompletedDatesInRange(
      USER_ID,
      "2026-05-01",
      "2026-05-31"
    );

    expect(dates).toEqual(["2026-05-15"]);
  });
});
