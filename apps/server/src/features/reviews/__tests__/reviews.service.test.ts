import { describe, expect, it, afterEach } from "vitest";
import { createTestDb } from "@pruvi/db/test-client";
import type { Database } from "@pruvi/db";
import { user } from "@pruvi/db/schema/auth";
import { subject } from "@pruvi/db/schema/subjects";
import { question } from "@pruvi/db/schema/questions";
import { recordAnswer } from "../reviews.service";

describe("reviews service", () => {
  let cleanup: (() => Promise<void>) | undefined;

  afterEach(async () => {
    await cleanup?.();
  });

  async function setupFixtures(db: Database) {
    await db.insert(user).values({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const subjects = await db
      .insert(subject)
      .values({ name: "Matemática", slug: "matematica" })
      .returning();
    const sub = subjects[0];
    if (!sub) throw new Error("Failed to insert subject");

    const questions = await db
      .insert(question)
      .values({
        body: "Quanto é 2 + 2?",
        options: ["1", "2", "3", "4"],
        correctOptionIndex: 3,
        difficulty: 1,
        subjectId: sub.id,
      })
      .returning();
    const q = questions[0];
    if (!q) throw new Error("Failed to insert question");

    return { questionId: q.id, correctOptionIndex: q.correctOptionIndex };
  }

  it("returns correct: true and increments repetitions on correct answer", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;

    const { questionId, correctOptionIndex } = await setupFixtures(typedDb);

    const result = await recordAnswer(typedDb, {
      userId: "user-1",
      questionId,
      selectedOptionIndex: correctOptionIndex,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.correct).toBe(true);
    expect(result.value.correctOptionIndex).toBe(correctOptionIndex);
    expect(result.value.reviewLog.repetitions).toBe(1);
    expect(result.value.reviewLog.interval).toBe(1);
    expect(result.value.reviewLog.easeFactor).toBeGreaterThan(2.5);
  });

  it("returns correct: false and resets repetitions on wrong answer", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;

    const { questionId, correctOptionIndex } = await setupFixtures(typedDb);
    const wrongIndex = correctOptionIndex === 0 ? 1 : 0;

    const result = await recordAnswer(typedDb, {
      userId: "user-1",
      questionId,
      selectedOptionIndex: wrongIndex,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.correct).toBe(false);
    expect(result.value.reviewLog.repetitions).toBe(0);
    expect(result.value.reviewLog.interval).toBe(1);
  });

  it("returns NotFoundError when question does not exist", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;

    await db.insert(user).values({
      id: "user-1",
      name: "Test User",
      email: "test@example.com",
      emailVerified: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const result = await recordAnswer(typedDb, {
      userId: "user-1",
      questionId: 9999,
      selectedOptionIndex: 0,
    });

    expect(result.isErr()).toBe(true);
    if (!result.isErr()) return;
    expect(result.error.code).toBe("NOT_FOUND");
  });

  it("uses previous SM-2 state on second review", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;

    const { questionId, correctOptionIndex } = await setupFixtures(typedDb);

    // First review - correct
    await recordAnswer(typedDb, {
      userId: "user-1",
      questionId,
      selectedOptionIndex: correctOptionIndex,
    });

    // Second review - correct (interval should jump to 6)
    const result = await recordAnswer(typedDb, {
      userId: "user-1",
      questionId,
      selectedOptionIndex: correctOptionIndex,
    });

    expect(result.isOk()).toBe(true);
    if (!result.isOk()) return;
    expect(result.value.reviewLog.repetitions).toBe(2);
    expect(result.value.reviewLog.interval).toBe(6);
  });

  it("isolates SM-2 state between different users", async () => {
    const { db, client } = await createTestDb();
    cleanup = () => client.close();
    const typedDb = db as unknown as Database;

    await db.insert(user).values([
      {
        id: "user-1",
        name: "Alice",
        email: "alice@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "user-2",
        name: "Bob",
        email: "bob@example.com",
        emailVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    const subjects = await db
      .insert(subject)
      .values({ name: "Física", slug: "fisica" })
      .returning();
    const sub = subjects[0];
    if (!sub) throw new Error("Failed to insert subject");

    const questions = await db
      .insert(question)
      .values({
        body: "Qual é a velocidade da luz?",
        options: ["300 km/s", "300.000 km/s", "30 km/s", "3.000 km/s"],
        correctOptionIndex: 1,
        difficulty: 2,
        subjectId: sub.id,
      })
      .returning();
    const q = questions[0];
    if (!q) throw new Error("Failed to insert question");

    // user-1 answers twice (correct each time)
    await recordAnswer(typedDb, { userId: "user-1", questionId: q.id, selectedOptionIndex: 1 });
    await recordAnswer(typedDb, { userId: "user-1", questionId: q.id, selectedOptionIndex: 1 });

    // user-2 answers for the first time
    const user2Result = await recordAnswer(typedDb, {
      userId: "user-2",
      questionId: q.id,
      selectedOptionIndex: 1,
    });

    expect(user2Result.isOk()).toBe(true);
    if (!user2Result.isOk()) return;
    // user-2's first answer should start at repetitions=1, not carry user-1's state
    expect(user2Result.value.reviewLog.repetitions).toBe(1);
    expect(user2Result.value.reviewLog.interval).toBe(1);
  });
});
